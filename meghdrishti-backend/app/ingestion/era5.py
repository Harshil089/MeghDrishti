"""ERA5 reanalysis adapter (Copernicus CDS). Requires ERA5_CDS_KEY; returns
empty results when not configured rather than fabricating data — ERA5 is
used as a context/reanalysis source, not a primary station feed, so callers
must treat an empty fetch as "unavailable", never as "zero".

CDS retrieval is an async queued job (submit → wait → download), not a
per-request sync call like the other adapters. cdsapi.Client() blocks, so it
runs in a thread via asyncio.to_thread. A single retrieve can take anywhere
from seconds to minutes depending on CDS queue load — this is inherent to
the service, not a bug here.
"""
from __future__ import annotations

import math
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
import netCDF4

from app.core.config import settings
from app.ingestion.base import WeatherSourceAdapter
from app.schemas.observation import CanonicalObservation, Location, Measurements

KELVIN_OFFSET = 273.15

# (lat, lon, date) -> {hour: measurements}. Per process; a day is ~25 s to fetch, ~0 s after.
_day_cache: dict[tuple, dict[int, dict]] = {}


class ERA5Adapter(WeatherSourceAdapter):
    source_name = "ERA5"

    def __init__(self):
        self.url = settings.era5_cds_url
        self.key = settings.era5_cds_key

    async def fetch(self, station: Any, start_time: datetime, end_time: datetime) -> list[dict]:
        if not self.key:
            return []
        import asyncio

        return await asyncio.to_thread(self._retrieve_sync, station, start_time)

    def _retrieve_sync(self, station: Any, at: datetime) -> list[dict]:
        key = (round(station.latitude, 3), round(station.longitude, 3), at.date())
        if key not in _day_cache:
            # One CDS job per station-day instead of per hour: queue wait dominates the cost.
            if len(_day_cache) >= 64:
                _day_cache.clear()
            _day_cache[key] = self._retrieve_day(station, at)
        measurements = _day_cache[key].get(at.hour)
        if measurements is None:
            return []
        return [
            {
                "station_id": station.station_code,
                "timestamp": at.replace(minute=0, second=0, microsecond=0).isoformat(),
                "location": {"latitude": station.latitude, "longitude": station.longitude},
                "measurements": measurements,
            }
        ]

    def _retrieve_day(self, station: Any, at: datetime) -> dict[int, dict]:
        import cdsapi

        client = cdsapi.Client(url=self.url, key=self.key, quiet=True)
        lat, lon = station.latitude, station.longitude
        request = {
            "product_type": ["reanalysis"],
            "variable": [
                "2m_temperature",
                "2m_dewpoint_temperature",
                "surface_pressure",
                "total_precipitation",
                "10m_u_component_of_wind",
                "10m_v_component_of_wind",
            ],
            "year": [f"{at.year:04d}"],
            "month": [f"{at.month:02d}"],
            "day": [f"{at.day:02d}"],
            "time": [f"{h:02d}:00" for h in range(24)],
            # small box around the station; ERA5's native grid is ~0.25deg
            "area": [lat + 0.25, lon - 0.25, lat - 0.25, lon + 0.25],
            "data_format": "netcdf",
        }
        with tempfile.TemporaryDirectory() as tmp:
            target = str(Path(tmp) / "era5.download")
            client.retrieve("reanalysis-era5-single-levels", request, target)
            return self._parse_day(_netcdf_files(target, Path(tmp)), station)

    def _parse_day(self, paths: list[str], station: Any) -> dict[int, dict]:
        # CDS splits instantaneous (t2m, u10, ...) and accumulated (tp) variables
        # into separate files, so look each variable up across all of them.
        datasets = [netCDF4.Dataset(p) for p in paths]
        try:
            ds = _Merged(datasets)
            lats = ds.variables.get("latitude", ds.variables.get("lat"))[:]
            lons = ds.variables.get("longitude", ds.variables.get("lon"))[:]
            i = int((abs(lats[:] - station.latitude)).argmin())
            j = int((abs(lons[:] - station.longitude)).argmin())

            def val(name: str, k: int) -> float | None:
                if name not in ds.variables:
                    return None
                v = ds.variables[name]
                if v.shape[0] <= k:
                    return None
                return float(v[k, i, j] if v.ndim == 3 else v[k, 0, i, j])

            # Hours were requested 00..23 in order, so the time axis index is the hour.
            hours: dict[int, dict] = {}
            for k in range(24):
                t2m, d2m, u10, v10, sp, tp = (val(n, k) for n in ("t2m", "d2m", "u10", "v10", "sp", "tp"))
                hours[k] = {
                    "temperature_c": t2m - KELVIN_OFFSET if t2m is not None else None,
                    "humidity_pct": _relative_humidity(t2m, d2m),
                    "pressure_hpa": sp / 100.0 if sp is not None else None,
                    "rainfall_mm": tp * 1000.0 if tp is not None else None,
                    "wind_speed_ms": math.hypot(u10, v10) if u10 is not None and v10 is not None else None,
                    "wind_direction_deg": _wind_direction(u10, v10),
                }
            return hours
        finally:
            for d in datasets:
                d.close()

    def normalize(self, payload: dict) -> CanonicalObservation:
        return CanonicalObservation(
            station_id=payload["station_id"],
            timestamp=payload["timestamp"],
            location=Location(**payload["location"]),
            measurements=Measurements(**payload.get("measurements", {})),
            source=self.source_name,
        )

    async def health_check(self) -> bool:
        """Actually pings CDS to confirm the key authenticates, not just presence."""
        if not self.key:
            return False
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(
                    f"{self.url.rstrip('/')}/retrieve/v1/jobs",
                    headers={"PRIVATE-TOKEN": self.key},
                )
                return resp.status_code < 400
            except httpx.HTTPError:
                return False


class _Merged:
    """Read-only view over several NetCDF datasets, exposing `.variables`."""

    def __init__(self, datasets: list):
        self.variables = {name: var for d in datasets for name, var in d.variables.items()}


def _netcdf_files(downloaded: str, workdir: Path) -> list[str]:
    """CDS returns a zip when a request spans several variable groups, else a bare .nc."""
    import zipfile

    if not zipfile.is_zipfile(downloaded):
        return [downloaded]
    with zipfile.ZipFile(downloaded) as z:
        z.extractall(workdir)
    return sorted(str(p) for p in workdir.glob("*.nc"))


def _relative_humidity(t2m_k: float | None, d2m_k: float | None) -> float | None:
    """Magnus-formula approximation from 2m temperature + dewpoint (both Kelvin)."""
    if t2m_k is None or d2m_k is None:
        return None
    t_c, d_c = t2m_k - KELVIN_OFFSET, d2m_k - KELVIN_OFFSET
    b = 17.625
    c = 243.04
    rh = 100 * math.exp((b * d_c) / (c + d_c)) / math.exp((b * t_c) / (c + t_c))
    return max(0.0, min(100.0, rh))


def _wind_direction(u: float | None, v: float | None) -> float | None:
    if u is None or v is None:
        return None
    return (math.degrees(math.atan2(-u, -v))) % 360
