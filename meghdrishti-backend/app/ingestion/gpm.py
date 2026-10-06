"""NASA GPM (Global Precipitation Measurement) adapter, via gpm-api.

Reads IMERG Early Run (near-real-time, ~4 h latency, half-hourly 0.1 degree grid)
and returns the rainfall accumulated at the station's grid cell over the
requested window. Requires NASA_GPM_USERNAME / NASA_GPM_PASSWORD. Returns empty
results when not configured, or when the window is not published yet; the
context engine treats that as "context unavailable", never as "zero rainfall".
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.ingestion.base import WeatherSourceAdapter
from app.schemas.observation import CanonicalObservation, Location, Measurements

PRODUCT = "IMERG-ER"
PRODUCT_TYPE = "NRT"
VERSION = 7

_configured = False


def _configure() -> None:
    """Write gpm-api's credential file once per process."""
    global _configured
    if _configured:
        return
    import gpm

    base_dir = Path(settings.nasa_gpm_data_dir).resolve()
    base_dir.mkdir(parents=True, exist_ok=True)
    creds = (
        {"username_pps": settings.nasa_gpm_username, "password_pps": settings.nasa_gpm_password}
        if settings.nasa_gpm_storage.upper() == "PPS"
        else {"username_earthdata": settings.nasa_gpm_username, "password_earthdata": settings.nasa_gpm_password}
    )
    gpm.define_configs(base_dir=str(base_dir), **creds)
    _configured = True


def _naive_utc(t: datetime) -> datetime:
    return t.astimezone(UTC).replace(tzinfo=None) if t.tzinfo else t


def _rainfall_mm(lat: float, lon: float, start: datetime, end: datetime) -> float | None:
    """Blocking: download granules (cached on disk under a dir named GPM, which gpm-api requires) and sum rainfall at one point."""
    import gpm

    _configure()
    start, end = _naive_utc(start), _naive_utc(end)
    # ponytail: downloads global half-hour granules per request (cached after
    # the first hit); subset server-side or batch per window if volume grows.
    gpm.download(
        product=PRODUCT,
        product_type=PRODUCT_TYPE,
        version=VERSION,
        start_time=start,
        end_time=end,
        storage=settings.nasa_gpm_storage,
        progress_bar=False,
        verbose=False,
    )
    ds = gpm.open_dataset(
        product=PRODUCT,
        product_type=PRODUCT_TYPE,
        version=VERSION,
        start_time=start,
        end_time=end,
        variables=["precipitation"],
    )
    rate = ds["precipitation"].sel(lat=lat, lon=lon, method="nearest")  # mm/h per 30-min step
    if rate.size == 0 or bool(rate.isnull().all()):
        return None
    return round(float(rate.sum(skipna=True)) * 0.5, 3)


class GPMAdapter(WeatherSourceAdapter):
    source_name = "NASA_GPM"

    def __init__(self):
        self.configured = bool(settings.nasa_gpm_username and settings.nasa_gpm_password)

    async def fetch(self, station: Any, start_time: datetime, end_time: datetime) -> list[dict]:
        if not self.configured:
            return []
        rainfall = await asyncio.to_thread(_rainfall_mm, station.latitude, station.longitude, start_time, end_time)
        if rainfall is None:
            return []
        return [
            {
                "station_id": str(station.id),
                "timestamp": end_time,
                "location": {"latitude": station.latitude, "longitude": station.longitude},
                "rainfall_mm": rainfall,
            }
        ]

    def normalize(self, payload: dict) -> CanonicalObservation:
        return CanonicalObservation(
            station_id=payload["station_id"],
            timestamp=payload["timestamp"],
            location=Location(**payload["location"]),
            measurements=Measurements(rainfall_mm=payload.get("rainfall_mm")),
            source=self.source_name,
        )

    async def health_check(self) -> bool:
        return self.configured
