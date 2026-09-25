from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Pagination, pagination_params
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.observations import WeatherObservation

router = APIRouter()


def _obs_out(o: WeatherObservation) -> dict:
    return {
        "id": str(o.id),
        "station_id": str(o.station_id),
        "timestamp": o.timestamp.isoformat(),
        "source": o.source,
        "measurements": {
            "temperature_c": o.temperature_c,
            "humidity_pct": o.humidity_pct,
            "pressure_hpa": o.pressure_hpa,
            "rainfall_mm": o.rainfall_mm,
            "wind_speed_ms": o.wind_speed_ms,
            "wind_direction_deg": o.wind_direction_deg,
        },
    }


@router.get("")
async def list_observations(
    station_id: uuid.UUID | None = None,
    source: str | None = None,
    pagination: Pagination = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WeatherObservation).order_by(WeatherObservation.timestamp.desc()).limit(pagination.limit).offset(pagination.offset)
    if station_id:
        stmt = stmt.where(WeatherObservation.station_id == station_id)
    if source:
        stmt = stmt.where(WeatherObservation.source == source)
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    return {"data": [_obs_out(o) for o in rows], "meta": {"limit": pagination.limit, "offset": pagination.offset}}


@router.get("/{observation_id}")
async def get_observation(observation_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WeatherObservation).where(WeatherObservation.id == observation_id))
    obs = result.scalar_one_or_none()
    if obs is None:
        raise NotFoundError("Observation does not exist", code="OBSERVATION_NOT_FOUND")
    return {"data": _obs_out(obs)}
