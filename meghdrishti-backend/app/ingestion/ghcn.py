"""NOAA GHCN-Daily adapter (successor to the decommissioned ISD feed).
Public dataset; GHCN_API_TOKEN optional but recommended."""
from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

from app.core.config import settings
from app.ingestion.base import WeatherSourceAdapter
from app.ingestion.ghcn_stations import nearest_station
from app.schemas.observation import CanonicalObservation, Location, Measurements


class GHCNAdapter(WeatherSourceAdapter):
    source_name = "GHCN"

    def __init__(self):
        self.base_url = settings.ghcn_base_url
        self.token = settings.ghcn_api_token

    async def fetch(self, station: Any, start_time: datetime, end_time: datetime) -> list[dict]:
        if not self.token:
            return []
        # GHCN station IDs (e.g. INA00420341) don't match our AWS station
        # codes — resolve to the nearest cached GHCN station by lat/lon.
        ghcn_station = nearest_station(station.latitude, station.longitude)
        if ghcn_station is None:
            return []
        headers = {"token": self.token}
        params = {
            "dataset": "daily-summaries",
            "stations": ghcn_station["station_id"],
            "startDate": start_time.strftime("%Y-%m-%d"),
            "endDate": end_time.strftime("%Y-%m-%d"),
            "format": "json",
        }
        async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
            resp = await client.get(self.base_url, params=params)
            resp.raise_for_status()
            return resp.json() if isinstance(resp.json(), list) else []

    def normalize(self, payload: dict) -> CanonicalObservation:
        if payload.get("LATITUDE") is None or payload.get("LONGITUDE") is None:
            raise ValueError("GHCN record missing LATITUDE/LONGITUDE")
        return CanonicalObservation(
            station_id=payload.get("STATION", ""),
            timestamp=payload["DATE"],
            location=Location(
                latitude=float(payload["LATITUDE"]),
                longitude=float(payload["LONGITUDE"]),
                elevation_m=float(payload["ELEVATION"]) if payload.get("ELEVATION") else None,
            ),
            measurements=Measurements(
                temperature_c=_avg_temp(payload.get("TMAX"), payload.get("TMIN")),
                wind_speed_ms=_parse_awnd(payload.get("AWND")),
                rainfall_mm=_parse_tenths(payload.get("PRCP")),
            ),
            source=self.source_name,
        )

    async def health_check(self) -> bool:
        return bool(self.token)


def _parse_tenths(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        return int(raw) / 10.0
    except ValueError:
        return None


def _parse_awnd(raw: str | None) -> float | None:
    """AWND ships in tenths of m/s in GHCN-Daily."""
    return _parse_tenths(raw)


def _avg_temp(tmax_raw: str | None, tmin_raw: str | None) -> float | None:
    tmax = _parse_tenths(tmax_raw)
    tmin = _parse_tenths(tmin_raw)
    if tmax is None or tmin is None:
        return tmax if tmax is not None else tmin
    return (tmax + tmin) / 2.0
