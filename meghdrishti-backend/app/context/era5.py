"""ERA5 context provider. Returns None (unavailable) when ERA5_CDS_KEY is not configured."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.core.logging import get_logger
from app.ingestion.era5 import ERA5Adapter

logger = get_logger("meghdrishti.context.era5")

_FIELD_MAP = {
    "temperature_c": "temperature_c",
    "pressure_hpa": "pressure_hpa",
    "humidity_pct": "humidity_pct",
}


# ERA5 publishes ~5 days behind real time; newer hours are rejected by CDS, and
# every attempt costs a queued job, so do not ask.
MIN_AGE = timedelta(days=6)

# One CDS job returns every variable, so share it across a reading's measurements.
# ponytail: unbounded-ish per-process dict, trimmed at 512; use Redis if workers need to share it.
_cache: dict[tuple[str, datetime], dict] = {}


async def fetch_era5_value(station, measurement: str, timestamp: datetime, adapter: ERA5Adapter | None = None) -> float | None:
    if measurement not in _FIELD_MAP:
        return None
    if datetime.now(UTC) - timestamp < MIN_AGE:
        return None
    hour = timestamp.replace(minute=0, second=0, microsecond=0)
    key = (str(station.id), hour)
    if key not in _cache:
        adapter = adapter or ERA5Adapter()
        try:
            # The adapter retrieves the single hour at its start_time argument.
            records = await adapter.fetch(station, hour, hour)
        except Exception as exc:  # noqa: BLE001
            logger.warning("era5_fetch_failed", error=str(exc)[:300])
            return None
        if not records:
            return None
        if len(_cache) >= 512:
            _cache.clear()
        _cache[key] = records[0].get("measurements", {})
    return _cache[key].get(_FIELD_MAP[measurement])
