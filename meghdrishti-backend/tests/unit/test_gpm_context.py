import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace

from app.context import gpm


class Failing:
    calls = 0

    async def fetch(self, *a):
        Failing.calls += 1
        raise RuntimeError("not published")


def test_a_failed_hour_is_not_retried_for_other_readings():
    gpm._missed.clear()
    st = SimpleNamespace()
    for minute in (0, 15, 30, 45):
        assert asyncio.run(gpm.fetch_gpm_rainfall(st, datetime(2026, 10, 1, 9, minute, tzinfo=UTC), Failing())) is None
    assert Failing.calls == 1
