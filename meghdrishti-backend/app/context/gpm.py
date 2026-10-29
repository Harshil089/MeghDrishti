"""NASA GPM context provider. Returns None (unavailable) when GPM credentials are not set
or IMERG has not published the window yet (Early Run lags ~4 h)."""
from __future__ import annotations

from datetime import datetime, timedelta

from app.ingestion.gpm import GPMAdapter, GPMCoolingDown

# Hours IMERG already failed to deliver in this process. A miss costs 10-35 s and the
# granule is global, so every other reading in that hour would only repeat it.
# ponytail: per-process and never expires; use Redis with a TTL if misses need retrying.
_missed: set[datetime] = set()


async def fetch_gpm_rainfall(station, timestamp: datetime, adapter: GPMAdapter | None = None) -> float | None:
    hour = timestamp.replace(minute=0, second=0, microsecond=0)
    if hour in _missed:
        return None
    adapter = adapter or GPMAdapter()
    try:
        records = await adapter.fetch(station, timestamp - timedelta(hours=1), timestamp)
    except GPMCoolingDown:
        return None  # temporary; do not mark the hour as permanently missed
    except Exception:  # noqa: BLE001
        _missed.add(hour)
        return None
    if not records:
        _missed.add(hour)
        return None
    return records[0].get("rainfall_mm")
