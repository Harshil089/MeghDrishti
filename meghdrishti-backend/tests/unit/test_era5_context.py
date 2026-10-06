import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

from app.context import era5


class FakeAdapter:
    calls = 0

    async def fetch(self, station, start, end):
        FakeAdapter.calls += 1
        return [{"measurements": {"temperature_c": 21.0, "pressure_hpa": 930.0, "humidity_pct": 80.0}}]


def test_skips_recent_and_fetches_old_hour_once():
    era5._cache.clear()
    station = SimpleNamespace(id="s1")
    recent = datetime.now(UTC) - timedelta(days=2)
    assert asyncio.run(era5.fetch_era5_value(station, "temperature_c", recent, FakeAdapter())) is None
    assert FakeAdapter.calls == 0

    old = datetime.now(UTC) - timedelta(days=10)
    assert asyncio.run(era5.fetch_era5_value(station, "temperature_c", old, FakeAdapter())) == 21.0
    assert asyncio.run(era5.fetch_era5_value(station, "pressure_hpa", old, FakeAdapter())) == 930.0
    assert FakeAdapter.calls == 1
