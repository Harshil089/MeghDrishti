"""NASA GPM context provider. Returns None (unavailable) when NASA_GPM_TOKEN is not configured."""
from __future__ import annotations

from datetime import datetime, timedelta

from app.ingestion.gpm import GPMAdapter


async def fetch_gpm_rainfall(station, timestamp: datetime, adapter: GPMAdapter | None = None) -> float | None:
    adapter = adapter or GPMAdapter()
    try:
        records = await adapter.fetch(station, timestamp - timedelta(hours=1), timestamp + timedelta(hours=1))
    except Exception:  # noqa: BLE001
        return None
    if not records:
        return None
    return records[0].get("rainfall_mm")
