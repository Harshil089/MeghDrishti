"""ERA5 reanalysis adapter (Copernicus CDS). Requires ERA5_CDS_KEY; returns
empty results when not configured rather than fabricating data — ERA5 is
used as a context/reanalysis source, not a primary station feed, so callers
must treat an empty fetch as "unavailable", never as "zero".
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from app.core.config import settings
from app.ingestion.base import WeatherSourceAdapter
from app.schemas.observation import CanonicalObservation, Location, Measurements


class ERA5Adapter(WeatherSourceAdapter):
    source_name = "ERA5"

    def __init__(self):
        self.url = settings.era5_cds_url
        self.key = settings.era5_cds_key

    async def fetch(self, station: Any, start_time: datetime, end_time: datetime) -> list[dict]:
        if not self.key:
            return []
        # CDS API requires an async batch-retrieve job (cdsapi client), out of
        # scope for a synchronous per-observation fetch; wire in when a CDS
        # key + retrieval workflow is available.
        return []

    def normalize(self, payload: dict) -> CanonicalObservation:
        return CanonicalObservation(
            station_id=payload["station_id"],
            timestamp=payload["timestamp"],
            location=Location(**payload["location"]),
            measurements=Measurements(**payload.get("measurements", {})),
            source=self.source_name,
        )

    async def health_check(self) -> bool:
        return bool(self.key)
