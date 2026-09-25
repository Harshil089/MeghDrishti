"""Canonical observation model — every ingestion source normalizes into this shape."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Location(BaseModel):
    latitude: float
    longitude: float
    elevation_m: float | None = None


class Measurements(BaseModel):
    temperature_c: float | None = None
    humidity_pct: float | None = None
    pressure_hpa: float | None = None
    rainfall_mm: float | None = None
    wind_speed_ms: float | None = None
    wind_direction_deg: float | None = None


class CanonicalObservation(BaseModel):
    station_id: str
    timestamp: datetime
    location: Location
    measurements: Measurements
    source: str
    received_at: datetime = Field(default_factory=lambda: datetime.now())
