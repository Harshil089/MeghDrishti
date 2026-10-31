"""IMD AWS adapter (api.imd.gov.in).

aws_data is a snapshot of the latest 15-minute reading from every reporting AWS,
with no date filter, so it cannot backfill. One snapshot is fetched per few
minutes and shared by every station. Needs IMD_API_KEY (bound to the server IP)
plus IMD_EMAIL / IMD_PASSWORD for the one-hour JWT.
"""
from __future__ import annotations

import re
import time
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.ingestion.base import WeatherSourceAdapter
from app.schemas.observation import CanonicalObservation, Location, Measurements

logger = get_logger("meghdrishti.ingestion.imd")

# IMD needs both the IP-bound API key and a one-hour JWT from the account login.
_token: tuple[str, float] | None = None


def _jwt() -> str:
    global _token
    if _token and _token[1] > time.time() + 60:
        return _token[0]
    resp = httpx.post(
        f"{settings.imd_api_base_url}/oauth/token.php",
        json={"email": settings.imd_email, "password": settings.imd_password},
        timeout=30,
    )
    resp.raise_for_status()
    body = resp.json()
    _token = (body["access_token"], time.time() + float(body.get("expires_in", 3600)))
    return _token[0]


def imd_get(endpoint: str) -> list | dict:
    """GET one IMD v1 endpoint (e.g. "aws_data", "aws_data_mapping")."""
    resp = httpx.get(
        f"{settings.imd_api_base_url}/v1/{endpoint}",
        headers={"X-API-KEY": settings.imd_api_key, "Authorization": f"Bearer {_jwt()}"},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def coord(raw: str | None) -> float | None:
    """IMD coordinates are strings and some carry stray characters (e.g. "?23.83")."""
    cleaned = re.sub(r"[^0-9.\-]", "", raw or "")
    try:
        return float(cleaned)
    except ValueError:
        return None


SNAPSHOT_TTL_S = 120  # shorter than the 5-minute poll, so every poll sees a fresh snapshot
_snapshot: tuple[float, list[dict]] = (0.0, [])


def _aws_snapshot() -> list[dict]:
    global _snapshot
    if time.time() - _snapshot[0] > SNAPSHOT_TTL_S:
        _snapshot = (time.time(), imd_get("aws_data"))
    return _snapshot[1]


def _num(raw: Any) -> float | None:
    if raw is None or str(raw).strip().upper() in {"", "NULL", "NA", "-"}:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _row_for(station: Any, rows: list[dict]) -> dict | None:
    # Only stations imported from aws_data_mapping take this feed. A curated station mapped to
    # its nearest AWS would duplicate that AWS's own row and "confirm" itself as a neighbour.
    if not station.station_code.startswith("IMD_AWS_"):
        return None
    imd_id = station.station_code.removeprefix("IMD_AWS_")
    return next((r for r in rows if r.get("ID") == imd_id), None)


# imd_id -> (slot time, running total, 15-minute amount derived for that slot).
# shortcut: in-process memory, so the first slot after an API restart has no rainfall; persist it if that gap matters.
_rain: dict[str, tuple[datetime, float, float | None]] = {}
SLOT = timedelta(minutes=15)


def _rain_day_start(ts: datetime) -> datetime:
    """IMD rain days run 03:00 to 03:00 UTC (08:30 IST); the 03:00 reading closes the old day."""
    start = ts.replace(hour=3, minute=0, second=0, microsecond=0)
    return start if ts > start else start - timedelta(days=1)


def rain_increment(imd_id: str, ts: datetime, total: float | None) -> float | None:
    """Turn IMD's running daily RAINFALL total into the amount that fell in this 15-minute slot.

    None when it cannot be told: no earlier slot, a skipped slot, or a total that went down
    without a day reset (bad data). Repeat calls for the same slot return the same answer.
    """
    if total is None:
        return None
    prev = _rain.get(imd_id)
    if prev and prev[0] == ts:
        return prev[2]
    day_start = _rain_day_start(ts)
    if ts - day_start <= SLOT:
        amount: float | None = total  # first slot of a new rain day: the whole total fell in it
    elif prev and ts - prev[0] == SLOT and prev[0] > day_start and total >= prev[1]:
        amount = round(total - prev[1], 2)
    else:
        amount = None
    _rain[imd_id] = (ts, total, amount)
    return amount


def to_payload(station: Any, row: dict) -> dict:
    wind_kmh = _num(row.get("WIND_SPEED"))
    direction = _num(row.get("WIND_DIRECTION"))
    ts = datetime.strptime(f"{row['DATE']} {row['TIME']}", "%Y-%m-%d %H:%M:%S").replace(tzinfo=UTC)
    total = _num(row.get("RAINFALL"))
    return {
        "station_id": station.station_code,
        "imd_id": row.get("ID"),
        "timestamp": ts.isoformat(),
        "rainfall_total_mm": total,  # IMD's running total since 03:00 UTC, kept for audit
        "location": {"latitude": station.latitude, "longitude": station.longitude},
        "measurements": {
            "temperature_c": _num(row.get("CURR_TEMP")),
            "humidity_pct": _num(row.get("RH")),
            "pressure_hpa": _num(row.get("MSLP")),
            # WIND_SPEED comes in km/h (whole knots x 1.852: 1.9, 3.7, 5.6 ...).
            "wind_speed_ms": round(wind_kmh / 3.6, 2) if wind_kmh is not None else None,
            # Direction is undefined in calm air; 0 deg with 0 speed is "no direction", not north.
            "wind_direction_deg": direction if wind_kmh else None,
            "rainfall_mm": rain_increment(row.get("ID") or station.station_code, ts, total),
        },
    }


class IMDAdapter(WeatherSourceAdapter):
    source_name = "IMD"

    def _configured(self) -> bool:
        return bool(settings.imd_enabled and settings.imd_api_base_url and settings.imd_api_key and settings.imd_email)

    async def fetch(self, station: Any, start_time: datetime, end_time: datetime) -> list[dict]:
        if not self._configured():
            logger.warning("imd_not_configured", station=getattr(station, "station_code", None))
            return []
        import asyncio

        row = _row_for(station, await asyncio.to_thread(_aws_snapshot))
        if row is None or not row.get("DATE") or not row.get("TIME"):
            return []
        payload = to_payload(station, row)
        m = payload["measurements"]
        # Offline AWS rows arrive with every field null except wind 0/0; that is not a reading.
        # Rain gauges (ARG) report rainfall only, so rainfall alone counts.
        if m["temperature_c"] is None and m["humidity_pct"] is None and m["pressure_hpa"] is None and m["rainfall_mm"] is None:
            return []
        ts = datetime.fromisoformat(payload["timestamp"])
        return [payload] if start_time <= ts <= end_time else []

    def normalize(self, payload: dict) -> CanonicalObservation:
        return CanonicalObservation(
            station_id=payload["station_id"],
            timestamp=payload["timestamp"],
            location=Location(**payload["location"]),
            measurements=Measurements(**payload["measurements"]),
            source=self.source_name,
        )

    async def health_check(self) -> bool:
        if not self._configured():
            return False
        try:
            import asyncio

            return bool(await asyncio.to_thread(_aws_snapshot))
        except httpx.HTTPError:
            return False
