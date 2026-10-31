from datetime import UTC, datetime, timedelta

import pytest

from app.models.observations import WeatherObservation
from app.models.stations import Station
from app.workers.pipeline import _ingestion_outage


@pytest.mark.asyncio
async def test_gap_with_no_readings_from_any_station_is_an_outage(db_session):
    a = Station(station_code="GAP_A", name="A", source="IMD_AWS", latitude=1.0, longitude=1.0)
    b = Station(station_code="GAP_B", name="B", source="IMD_AWS", latitude=1.1, longitude=1.1)
    db_session.add_all([a, b])
    await db_session.commit()
    t0 = datetime(2026, 10, 30, 4, 0, tzinfo=UTC)
    t1 = t0 + timedelta(hours=7)

    assert await _ingestion_outage(db_session, "IMD", t0, t1)  # nothing in between: our outage

    db_session.add(WeatherObservation(station_id=b.id, timestamp=t0 + timedelta(hours=3), received_at=t1, source="IMD", temperature_c=25.0))
    await db_session.commit()
    assert not await _ingestion_outage(db_session, "IMD", t0, t1)  # B reported, so A's gap is A's own
    assert not await _ingestion_outage(db_session, "IMD", t0, t0 + timedelta(minutes=30))  # short gaps never count
