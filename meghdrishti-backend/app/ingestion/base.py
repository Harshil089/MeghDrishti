"""Adapter interface every weather data source must implement."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from app.schemas.observation import CanonicalObservation


class WeatherSourceAdapter(ABC):
    """Every external weather data source sits behind this interface."""

    source_name: str

    @abstractmethod
    async def fetch(
        self, station: Any, start_time: datetime, end_time: datetime
    ) -> list[dict]:
        """Fetch raw payloads for a station within a time window. Never raises for empty results."""
        ...

    @abstractmethod
    def normalize(self, payload: dict) -> CanonicalObservation:
        """Transform one raw source payload into the canonical observation shape."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the source is currently reachable/usable."""
        ...
