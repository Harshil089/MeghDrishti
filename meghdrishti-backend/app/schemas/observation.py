"""Canonical observation model — every ingestion source normalizes into this shape."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

# Physical sanity bounds, not anomaly thresholds — wide enough to never clip
# genuine extreme weather (Vostok -89.2C, Death Valley 56.7C, wind gust
# 113 m/s), tight enough to catch sensor garbage / unit errors (e.g. Kelvin
# passed through unconverted). QC scoring, not this, decides what's a real
# anomaly vs a malfunction.
_BOUNDS = {
    "temperature_c": (-90.0, 60.0),
    "humidity_pct": (0.0, 100.0),
    "pressure_hpa": (830.0, 1090.0),
    "rainfall_mm": (0.0, 2000.0),
    "wind_speed_ms": (0.0, 130.0),
    "wind_direction_deg": (0.0, 360.0),
}


class Location(BaseModel):
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    elevation_m: float | None = None


class Measurements(BaseModel):
    temperature_c: float | None = None
    humidity_pct: float | None = None
    pressure_hpa: float | None = None
    rainfall_mm: float | None = None
    wind_speed_ms: float | None = None
    wind_direction_deg: float | None = None

    @field_validator(*_BOUNDS.keys())
    @classmethod
    def _within_physical_bounds(cls, value: float | None, info) -> float | None:
        if value is None:
            return value
        low, high = _BOUNDS[info.field_name]
        if not (low <= value <= high):
            raise ValueError(f"{info.field_name}={value} outside physical bounds [{low}, {high}]")
        return value


class CanonicalObservation(BaseModel):
    station_id: str
    timestamp: datetime
    location: Location
    measurements: Measurements
    source: str
    received_at: datetime = Field(default_factory=lambda: datetime.now())
