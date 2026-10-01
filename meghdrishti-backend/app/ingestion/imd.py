"""IMD provider adapter. Requires enabled access and real credentials."""
from __future__ import annotations

from datetime import datetime
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
        if not settings.imd_enabled or not self.base_url or not self.api_key:
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
        if not settings.imd_enabled or not self.base_url or not self.api_key:
            return False
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/health")
                return resp.status_code == 200
        except httpx.TransportError:
            return False
