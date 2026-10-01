from datetime import UTC, datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest

from app.ingestion.open_meteo import OpenMeteoAdapter


@pytest.mark.asyncio
async def test_open_meteo_requests_ms_and_preserves_utc_window():
    def handler(request):
        assert request.url.params["wind_speed_unit"] == "ms"
        assert request.url.params["timezone"] == "UTC"
        assert request.url.params["start_date"] == "2026-09-30"
        return httpx.Response(200, json={"hourly": {
            "time": ["2026-09-30T23:00", "2026-10-01T00:00", "2026-10-01T01:00"],
            "temperature_2m": [24.0] * 3,
            "wind_speed_10m": [3.6] * 3,
        }})

    station = SimpleNamespace(station_code="TEST", latitude=18.5, longitude=73.8)
    india = timezone(timedelta(hours=5, minutes=30))
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = OpenMeteoAdapter(client=client)
        records = await adapter.fetch(station, datetime(2026, 10, 1, 5, 0, tzinfo=india),
                                      datetime(2026, 10, 1, 6, 0, tzinfo=india))
    assert len(records) == 1
    canonical = adapter.normalize(records[0])
    assert canonical.timestamp == datetime(2026, 10, 1, tzinfo=UTC)
    assert canonical.measurements.wind_speed_ms == 3.6
