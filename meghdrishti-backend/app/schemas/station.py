from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class StationCreate(BaseModel):
    station_code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    source: str = Field(min_length=1, max_length=64, pattern=r"^[A-Z0-9_]+$")
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    elevation_m: float | None = Field(default=None, ge=-500, le=9000)
    region: str | None = Field(default=None, max_length=128)


class StationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None
    region: str | None = Field(default=None, max_length=128)


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
