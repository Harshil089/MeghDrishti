"""ERA5 context provider. Returns None (unavailable) when ERA5_CDS_KEY is not configured."""
from __future__ import annotations

from datetime import datetime, timedelta

from app.ingestion.era5 import ERA5Adapter

_FIELD_MAP = {
    "temperature_c": "temperature_c",
    "pressure_hpa": "pressure_hpa",
    "humidity_pct": "humidity_pct",
}


async def fetch_era5_value(station, measurement: str, timestamp: datetime, adapter: ERA5Adapter | None = None) -> float | None:
    if measurement not in _FIELD_MAP:
        return None
    adapter = adapter or ERA5Adapter()
    try:
        records = await adapter.fetch(station, timestamp - timedelta(hours=1), timestamp + timedelta(hours=1))
    except Exception:  # noqa: BLE001
        return None
    if not records:
        return None
    return records[0].get("measurements", {}).get(_FIELD_MAP[measurement])
