from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.ingestion.imd import IMDDemoAdapter
from app.ingestion.manager import ingest_station
from app.ingestion.open_meteo import OpenMeteoAdapter
from app.models.stations import Station


def _station():
    return Station(
        station_code="TEST001",
        name="Test Station",
        source="TEST",
        latitude=18.5,
        longitude=73.8,
        elevation_m=560,
        region="TEST",
    )


@pytest.mark.asyncio
async def test_open_meteo_ingestion_end_to_end(db_session):
    station = _station()
    db_session.add(station)
    await db_session.commit()

    fake_body = {
        "hourly": {
            "time": ["2026-09-24T00:00", "2026-09-24T01:00"],
            "temperature_2m": [28.5, 29.1],
            "relative_humidity_2m": [70.0, 68.0],
            "surface_pressure": [1008.2, 1008.0],
            "precipitation": [0.0, 0.2],
            "wind_speed_10m": [3.1, 3.4],
            "wind_direction_10m": [180.0, 190.0],
        }
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=fake_body)

    transport = httpx.MockTransport(handler)
    client = httpx.AsyncClient(transport=transport)
    adapter = OpenMeteoAdapter(client=client)

    start = datetime(2026, 9, 24, tzinfo=timezone.utc)
    end = start + timedelta(hours=2)

    result = await ingest_station(db_session, station, adapter, start, end)
    await client.aclose()

    assert result.fetched == 2
    assert result.raw_stored == 2
    assert result.normalized == 2
    assert result.duplicates == 0


@pytest.mark.asyncio
async def test_duplicate_payload_does_not_create_duplicate_observation(db_session):
    station = _station()
    db_session.add(station)
    await db_session.commit()

    adapter = IMDDemoAdapter()
    start = datetime(2026, 9, 24, tzinfo=timezone.utc)
    end = start  # single 15-min record

    first = await ingest_station(db_session, station, adapter, start, end)
    second = await ingest_station(db_session, station, adapter, start, end)

    assert first.normalized == 1
    assert second.normalized == 0
    assert second.duplicates == 1


@pytest.mark.asyncio
async def test_schema_invalid_payload_rejected_not_lost(db_session):
    station = _station()
    db_session.add(station)
    await db_session.commit()

    class BrokenAdapter(IMDDemoAdapter):
        source_name = "IMD_DEMO_BROKEN"

        async def fetch(self, station, start_time, end_time):
            return [{"station_id": station.station_code, "timestamp": "not-a-real-payload"}]

    adapter = BrokenAdapter()
    start = datetime(2026, 9, 24, tzinfo=timezone.utc)
    result = await ingest_station(db_session, station, adapter, start, start)

    assert result.raw_stored == 1
    assert result.schema_invalid == 1
    assert result.normalized == 0
