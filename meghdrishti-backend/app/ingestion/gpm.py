"""NASA GPM (Global Precipitation Measurement) adapter. Requires NASA_GPM_TOKEN
(Earthdata login). Returns empty results when not configured; treated as
"context unavailable" by the context engine, never as "zero rainfall".
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from app.core.config import settings
from app.ingestion.base import WeatherSourceAdapter
from app.schemas.observation import CanonicalObservation, Location, Measurements


class GPMAdapter(WeatherSourceAdapter):
    source_name = "NASA_GPM"

    def __init__(self):
        self.base_url = settings.nasa_gpm_base_url
        self.token = settings.nasa_gpm_token

    async def fetch(self, station: Any, start_time: datetime, end_time: datetime) -> list[dict]:
        if not self.token:
            return []
        # GPM IMERG granule download + subsetting is a batch workflow, not a
        # single REST call; wire in via the Airflow context/backfill DAGs.
        return []

    def normalize(self, payload: dict) -> CanonicalObservation:
        return CanonicalObservation(
            station_id=payload["station_id"],
            timestamp=payload["timestamp"],
            location=Location(**payload["location"]),
            measurements=Measurements(rainfall_mm=payload.get("rainfall_mm")),
            source=self.source_name,
        )

    async def health_check(self) -> bool:
        return bool(self.token)
