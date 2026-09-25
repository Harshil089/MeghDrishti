from __future__ import annotations

import uuid

from pydantic import BaseModel


class StationCreate(BaseModel):
    station_code: str
    name: str
    source: str
    latitude: float
    longitude: float
    elevation_m: float | None = None
    region: str | None = None


class StationUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    region: str | None = None


class StationOut(BaseModel):
    id: uuid.UUID
    station_code: str
    name: str
    source: str
    latitude: float
    longitude: float
    elevation_m: float | None
    region: str | None
    is_active: bool

    model_config = {"from_attributes": True}
