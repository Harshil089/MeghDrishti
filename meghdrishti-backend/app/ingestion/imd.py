"""IMD adapter.

IMD (India Meteorological Department) credentials are not always available.
This module provides:

  - IMDAdapter: real adapter interface, active only when IMD_ENABLED=true and
    IMD_API_BASE_URL/IMD_API_KEY are configured. Talks to whatever REST
    endpoint operators point it at — no private/undocumented API is assumed
    or fabricated here.
  - IMDDemoAdapter: a clearly-labeled synthetic data generator (source tag
    "IMD_DEMO") used so the rest of the pipeline can be exercised end-to-end
    without real credentials. It never claims to be genuine IMD data.

get_imd_adapter() picks the right one from settings, so the app functions
with or without IMD credentials.
"""
from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta
from typing import Any

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.ingestion.base import WeatherSourceAdapter
from app.schemas.observation import CanonicalObservation, Location, Measurements

logger = get_logger("meghdrishti.ingestion.imd")


class IMDAdapter(WeatherSourceAdapter):
    """Real IMD adapter. Requires IMD_API_BASE_URL + IMD_API_KEY."""

    source_name = "IMD"

    def __init__(self):
        self.base_url = settings.imd_api_base_url
        self.api_key = settings.imd_api_key

    async def fetch(self, station: Any, start_time: datetime, end_time: datetime) -> list[dict]:
        if not self.base_url or not self.api_key:
            logger.warning("imd_not_configured", station=getattr(station, "station_code", None))
            return []
        async with httpx.AsyncClient(timeout=10.0, headers={"Authorization": f"Bearer {self.api_key}"}) as client:
            resp = await client.get(
                f"{self.base_url}/observations",
                params={
                    "station_id": station.station_code,
                    "start": start_time.isoformat(),
                    "end": end_time.isoformat(),
                },
            )
            resp.raise_for_status()
            return resp.json().get("observations", [])

    def normalize(self, payload: dict) -> CanonicalObservation:
        return CanonicalObservation(
            station_id=payload["station_id"],
            timestamp=payload["timestamp"],
            location=Location(**payload["location"]),
            measurements=Measurements(**payload.get("measurements", {})),
            source=self.source_name,
        )

    async def health_check(self) -> bool:
        if not self.base_url or not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/health")
                return resp.status_code == 200
        except httpx.TransportError:
            return False


class IMDDemoAdapter(WeatherSourceAdapter):
    """Deterministic synthetic data generator. Tags all output IMD_DEMO."""

    source_name = "IMD_DEMO"

    async def fetch(self, station: Any, start_time: datetime, end_time: datetime) -> list[dict]:
        records = []
        t = start_time
        seed = int(hashlib.sha256(station.station_code.encode()).hexdigest(), 16) % (2**32)
        rng = random.Random(seed)
        base_temp = 22 + (station.latitude - 20) * -0.3
        while t <= end_time:
            records.append(
                {
                    "station_id": station.station_code,
                    "timestamp": t.isoformat(),
                    "latitude": station.latitude,
                    "longitude": station.longitude,
                    "elevation_m": getattr(station, "elevation_m", None),
                    "temperature_c": round(base_temp + rng.uniform(-2, 2), 1),
                    "humidity_pct": round(rng.uniform(40, 90), 1),
                    "pressure_hpa": round(1008 + rng.uniform(-3, 3), 1),
                    "rainfall_mm": round(max(0.0, rng.gauss(0, 1)), 1),
                    "wind_speed_ms": round(max(0.0, rng.gauss(3, 1.5)), 1),
                    "wind_direction_deg": round(rng.uniform(0, 360), 0),
                }
            )
            t += timedelta(minutes=15)
        return records

    def normalize(self, payload: dict) -> CanonicalObservation:
        return CanonicalObservation(
            station_id=payload["station_id"],
            timestamp=payload["timestamp"],
            location=Location(
                latitude=payload["latitude"],
                longitude=payload["longitude"],
                elevation_m=payload.get("elevation_m"),
            ),
            measurements=Measurements(
                temperature_c=payload.get("temperature_c"),
                humidity_pct=payload.get("humidity_pct"),
                pressure_hpa=payload.get("pressure_hpa"),
                rainfall_mm=payload.get("rainfall_mm"),
                wind_speed_ms=payload.get("wind_speed_ms"),
                wind_direction_deg=payload.get("wind_direction_deg"),
            ),
            source=self.source_name,
        )

    async def health_check(self) -> bool:
        return True


def get_imd_adapter() -> WeatherSourceAdapter:
    if settings.imd_enabled and settings.imd_api_base_url and settings.imd_api_key:
        return IMDAdapter()
    return IMDDemoAdapter()
