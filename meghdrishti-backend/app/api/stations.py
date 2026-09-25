from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Pagination, pagination_params
from app.core.exceptions import NotFoundError
from app.core.permissions import Permission, require_permission
from app.db.session import get_db
from app.repositories.anomaly_repository import AnomalyRepository
from app.repositories.observation_repository import ObservationRepository
from app.repositories.station_repository import StationRepository
from app.schemas.station import StationCreate, StationUpdate

router = APIRouter()


def _station_out(s):
    return {
        "id": str(s.id),
        "station_code": s.station_code,
        "name": s.name,
        "source": s.source,
        "latitude": s.latitude,
        "longitude": s.longitude,
        "elevation_m": s.elevation_m,
        "region": s.region,
        "is_active": s.is_active,
    }


@router.get("")
async def list_stations(
    region: str | None = None,
    is_active: bool | None = None,
    pagination: Pagination = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    repo = StationRepository(db)
    stations = await repo.list(pagination.limit, pagination.offset, region, is_active)
    return {"data": [_station_out(s) for s in stations], "meta": {"limit": pagination.limit, "offset": pagination.offset}}


@router.post("")
async def create_station(
    payload: StationCreate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MANAGE_STATIONS)),
):
    repo = StationRepository(db)
    station = await repo.create(**payload.model_dump())
    return {"data": _station_out(station)}


@router.get("/{station_id}")
async def get_station(station_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = StationRepository(db)
    station = await repo.get(station_id)
    if station is None:
        raise NotFoundError("Station does not exist", code="STATION_NOT_FOUND")
    return {"data": _station_out(station)}


@router.patch("/{station_id}")
async def update_station(
    station_id: uuid.UUID,
    payload: StationUpdate,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MANAGE_STATIONS)),
):
    repo = StationRepository(db)
    station = await repo.get(station_id)
    if station is None:
        raise NotFoundError("Station does not exist", code="STATION_NOT_FOUND")
    station = await repo.update(station, **payload.model_dump(exclude_unset=True))
    return {"data": _station_out(station)}


@router.get("/{station_id}/health")
async def get_station_health(station_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    from app.repositories.health_repository import HealthRepository

    repo = HealthRepository(db)
    health = await repo.get_latest(station_id)
    if health is None:
        return {"data": None, "meta": {"message": "Health not yet computed for this station"}}
    return {
        "data": {
            "station_id": str(station_id),
            "health_score": health.health_score,
            "status": health.status,
            "issues": health.issues,
            "components": health.components,
        }
    }


@router.get("/{station_id}/observations")
async def get_station_observations(
    station_id: uuid.UUID, pagination: Pagination = Depends(pagination_params), db: AsyncSession = Depends(get_db)
):
    repo = ObservationRepository(db)
    obs = await repo.list_for_station(station_id, pagination.limit, pagination.offset)
    return {
        "data": [
            {
                "id": str(o.id),
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
            for o in obs
        ],
        "meta": {"limit": pagination.limit, "offset": pagination.offset},
    }


@router.get("/{station_id}/anomalies")
async def get_station_anomalies(
    station_id: uuid.UUID, pagination: Pagination = Depends(pagination_params), db: AsyncSession = Depends(get_db)
):
    repo = AnomalyRepository(db)
    anomalies = await repo.list(pagination.limit, pagination.offset, station_id=station_id)
    return {
        "data": [
            {
                "id": str(a.id),
                "classification": a.classification,
                "severity": a.severity,
                "confidence": a.confidence,
                "fault_score": a.fault_score,
                "reason_codes": a.reason_codes,
                "created_at": a.created_at.isoformat(),
            }
            for a in anomalies
        ],
        "meta": {"limit": pagination.limit, "offset": pagination.offset},
    }
