"""NOAA ISD adapter. Public dataset; NOAA_API_TOKEN optional but recommended."""
from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

from app.core.config import settings
from app.ingestion.base import WeatherSourceAdapter
from app.schemas.observation import CanonicalObservation, Location, Measurements


class NOAAAdapter(WeatherSourceAdapter):
    source_name = "NOAA"

    def __init__(self):
        self.base_url = settings.noaa_isd_base_url
        self.token = settings.noaa_api_token

    async def fetch(self, station: Any, start_time: datetime, end_time: datetime) -> list[dict]:
        if not self.token:
            return []
        headers = {"token": self.token}
        params = {
            "dataset": "global-hourly",
            "stations": station.station_code,
            "startDate": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "endDate": end_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "format": "json",
        }
        async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
            resp = await client.get(self.base_url, params=params)
            resp.raise_for_status()
            return resp.json() if isinstance(resp.json(), list) else []

    def normalize(self, payload: dict) -> CanonicalObservation:
        return CanonicalObservation(
            station_id=payload.get("STATION", ""),
            timestamp=payload["DATE"],
            location=Location(
                latitude=float(payload.get("LATITUDE", 0)),
                longitude=float(payload.get("LONGITUDE", 0)),
                elevation_m=float(payload["ELEVATION"]) if payload.get("ELEVATION") else None,
            ),
            measurements=Measurements(
                temperature_c=_parse_temp(payload.get("TMP")),
                wind_speed_ms=_parse_wind(payload.get("WND")),
                pressure_hpa=_parse_slp(payload.get("SLP")),
            ),
            source=self.source_name,
        )

    async def health_check(self) -> bool:
        return bool(self.token)


def _parse_temp(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        value = int(raw.split(",")[0])
        return value / 10.0 if value != 9999 else None
    except (ValueError, IndexError):
        return None


def _parse_wind(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        value = int(raw.split(",")[3])
        return value / 10.0 if value != 9999 else None
    except (ValueError, IndexError):
        return None


def _parse_slp(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        value = int(raw.split(",")[0])
        return value / 10.0 if value != 99999 else None
    except (ValueError, IndexError):
        return None
