"""NASA GPM (Global Precipitation Measurement) adapter, via gpm-api.

Reads IMERG Early Run (near-real-time, ~4 h latency, half-hourly 0.1 degree grid)
and returns the rainfall accumulated at the station's grid cell over the
requested window. Requires NASA_GPM_TOKEN (preferred) or NASA_GPM_USERNAME / NASA_GPM_PASSWORD. Returns empty
results when not configured, or when the window is not published yet; the
context engine treats that as "context unavailable", never as "zero rainfall".
"""
from __future__ import annotations

import asyncio
import fcntl
import subprocess
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.ingestion.base import WeatherSourceAdapter
from app.schemas.observation import CanonicalObservation, Location, Measurements

PRODUCT = "IMERG-ER"
PRODUCT_TYPE = "NRT"
VERSION = 7

_configured = False
# gpm-api still points at gpm1.gesdisc.eosdis.nasa.gov, which no longer accepts connections;
# granules now live on this host and accept an Earthdata bearer token.
GESDISC_HOST = "https://data.gesdisc.earthdata.nasa.gov/data/GPM_L3/GPM_3IMERGHHE.07"
COOLDOWN_FILE = ".cooldown"
MIN_GRANULE_BYTES = 100_000  # real IMERG half-hour files are ~7 MB; error pages are ~100 bytes


class GPMCoolingDown(Exception):
    """NASA refused the login (Earthdata locks an account after repeated failures); stop trying for a while."""


def _data_dir() -> Path:
    return Path(settings.nasa_gpm_data_dir).resolve()


def _cooldown_left() -> float:
    try:
        return float((_data_dir() / COOLDOWN_FILE).read_text()) - time.time()
    except (OSError, ValueError):
        return 0.0


def _check_cooldown() -> None:
    if (left := _cooldown_left()) > 0:
        raise GPMCoolingDown(f"GPM paused for another {int(left)} s")


def _wait_out_cooldown() -> None:
    """Block this worker until the pause ends: skipping GPM would persist a lower-confidence
    result for the reading, and waiting 10-15 minutes once is cheaper than that."""
    while (left := _cooldown_left()) > 0:
        time.sleep(min(left, 30))


def _purge_bad_granules(start: datetime, end: datetime) -> None:
    """gpm-api saves the server's error page as if it were a granule. Delete those, and
    if NASA reported a lockout back off for 15 minutes instead of retrying into it."""
    day, bad, locked = start.date(), [], False
    while day <= end.date():
        folder = _data_dir() / "NRT/IMERG/IMERG-ER" / f"{day:%Y/%m/%d}"
        bad += [f for f in folder.glob("*.HDF5") if f.stat().st_size < MIN_GRANULE_BYTES]
        day = day.fromordinal(day.toordinal() + 1)
    for f in bad:
        locked = locked or "locked" in f.read_text(errors="ignore")
        f.unlink()
    if bad:
        pause = 900 if locked else 120
        (_data_dir() / COOLDOWN_FILE).write_text(str(time.time() + pause))
        raise GPMCoolingDown(f"IMERG download returned an error page ({'account locked' if locked else 'unavailable'})")


def _granule_names(granule_start: datetime) -> list[str]:
    """IMERG half-hour file names; the data host offers no directory listing, and the
    processing-version letter varies (V07C current, V07B for earlier runs)."""
    end = granule_start + timedelta(minutes=29, seconds=59)
    minutes = granule_start.hour * 60 + granule_start.minute
    stem = f"3B-HHR-E.MS.MRG.3IMERG.{granule_start:%Y%m%d}-S{granule_start:%H%M%S}-E{end:%H%M%S}.{minutes:04d}"
    return [f"{stem}.V07{letter}.HDF5" for letter in "CB"]


def _download_with_token(start: datetime, end: datetime) -> None:
    """Fetch the half-hour granules overlapping [start, end] with the Earthdata bearer token."""
    token = settings.nasa_gpm_token.strip()
    granule_start = start.replace(minute=start.minute - start.minute % 30, second=0, microsecond=0)
    while granule_start < end:
        folder = _data_dir() / "NRT/IMERG/IMERG-ER" / f"{granule_start:%Y/%m/%d}"
        url_dir = f"{GESDISC_HOST}/{granule_start.year}/{granule_start.timetuple().tm_yday:03d}/"
        names = _granule_names(granule_start)
        if not any((folder / n).exists() and (folder / n).stat().st_size >= MIN_GRANULE_BYTES for n in names):
            folder.mkdir(parents=True, exist_ok=True)
            error = ""
            for name in names:
                tmp = (folder / name).with_suffix(".part")
                result = subprocess.run(
                    ["curl", "-sS", "-L", "--fail", "-m", "300", "-H", f"Authorization: Bearer {token}", "-o", str(tmp), url_dir + name],
                    capture_output=True, text=True,
                )
                if not result.returncode and tmp.exists() and tmp.stat().st_size >= MIN_GRANULE_BYTES:
                    tmp.rename(folder / name)
                    break
                tmp.unlink(missing_ok=True)
                error = result.stderr.strip()[:200]
            else:
                raise RuntimeError(f"GPM granule {names[0]} not available: {error}")
            for stale in folder.glob("*.HDF5"):  # error pages saved by older gpm-api runs
                if stale.stat().st_size < MIN_GRANULE_BYTES:
                    stale.unlink()
        granule_start += timedelta(minutes=30)


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
    if settings.nasa_gpm_token.strip():
        with open(_data_dir() / ".download.lock", "w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            _download_with_token(start, end)
        return _sum_rainfall(lat, lon, start, end)
    # ponytail: downloads global half-hour granules per request (cached after
    # the first hit); subset server-side or batch per window if volume grows.
    for attempt in (1, 2):
        _wait_out_cooldown()
        try:
            # Parallel workers hit the same global granule at once; serialize the
            # download (already-cached files return fast) so none is written twice.
            with open(_data_dir() / ".download.lock", "w") as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                gpm.download(
                    product=PRODUCT,
                    product_type=PRODUCT_TYPE,
                    version=VERSION,
                    start_time=start,
                    end_time=end,
                    storage=settings.nasa_gpm_storage,
                    # One login at a time: four parallel curl logins per call is what trips
                    # Earthdata's "too many login attempts" lockout.
                    n_threads=1,
                    progress_bar=False,
                    verbose=False,
                    # The integrity/completeness pass logs in to PPS to list server files,
                    # which fails for Earthdata-only users and discards the whole download.
                    check_integrity=False,
                )
            _purge_bad_granules(start, end)
            break
        except GPMCoolingDown:
            if attempt == 2:
                raise
    return _sum_rainfall(lat, lon, start, end)


def _sum_rainfall(lat: float, lon: float, start: datetime, end: datetime) -> float | None:
    import gpm

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
        self.configured = bool(settings.nasa_gpm_token.strip() or (settings.nasa_gpm_username and settings.nasa_gpm_password))

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
