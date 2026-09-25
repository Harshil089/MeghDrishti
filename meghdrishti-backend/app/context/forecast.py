"""Forecast context provider: nearest Open-Meteo hourly value to the observation timestamp."""
from __future__ import annotations

import time
from datetime import datetime, timedelta

from app.core.metrics import context_fetch_duration_seconds, context_provider_availability
from app.ingestion.open_meteo import OpenMeteoAdapter

_FIELD_MAP = {
    "temperature_c": "temperature_2m",
    "humidity_pct": "relative_humidity_2m",
    "pressure_hpa": "surface_pressure",
    "rainfall_mm": "precipitation",
    "wind_speed_ms": "wind_speed_10m",
    "wind_direction_deg": "wind_direction_10m",
}


async def fetch_forecast_value(station, measurement: str, timestamp: datetime, adapter: OpenMeteoAdapter | None = None) -> float | None:
    field = _FIELD_MAP.get(measurement)
    if field is None:
        return None

    adapter = adapter or OpenMeteoAdapter()
    start = time.perf_counter()
    try:
        records = await adapter.fetch(station, timestamp - timedelta(hours=1), timestamp + timedelta(hours=1))
    except Exception:  # noqa: BLE001 — forecast unavailability must not break the pipeline
        context_provider_availability.labels(provider="forecast").set(0)
        return None
    finally:
        context_fetch_duration_seconds.labels(provider="forecast").observe(time.perf_counter() - start)

    if not records:
        context_provider_availability.labels(provider="forecast").set(0)
        return None
    context_provider_availability.labels(provider="forecast").set(1)

    field_key = {
        "temperature_2m": "temperature_2m",
        "relative_humidity_2m": "relative_humidity_2m",
        "surface_pressure": "surface_pressure",
        "precipitation": "precipitation",
        "wind_speed_10m": "wind_speed_10m",
        "wind_direction_10m": "wind_direction_10m",
    }[field]

    naive_ts = timestamp.replace(tzinfo=None)
    best = min(records, key=lambda r: abs(_parse(r["time"]) - naive_ts))
    return best.get(field_key)


def _parse(t: str) -> datetime:
    return datetime.fromisoformat(t).replace(tzinfo=None)
