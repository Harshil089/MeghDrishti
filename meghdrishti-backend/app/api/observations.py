from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Pagination, pagination_params
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.anomalies import Anomaly
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
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    pagination: Pagination = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    conditions = []
    if station_id:
        conditions.append(WeatherObservation.station_id == station_id)
    if source:
        conditions.append(WeatherObservation.source == source)
    if start_time:
        conditions.append(WeatherObservation.timestamp >= start_time)
    if end_time:
        conditions.append(WeatherObservation.timestamp <= end_time)
    stmt = (
        select(WeatherObservation)
        .where(*conditions)
        .order_by(WeatherObservation.timestamp.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    total = (await db.execute(select(func.count()).select_from(WeatherObservation).where(*conditions))).scalar_one()
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    # Quality flags per reading, so the audit log shows what was raised against it.
    flags: dict[uuid.UUID, list[dict]] = {}
    if rows:
        found = await db.execute(
            select(Anomaly)
            .where(Anomaly.observation_id.in_([o.id for o in rows]), Anomaly.classification != "NORMAL")
        )
        for a in found.scalars():
            flags.setdefault(a.observation_id, []).append(
                {
                    "anomaly_id": str(a.id),
                    "measurement": a.measurement,
                    "classification": a.classification,
                    "severity": a.severity,
                    "fault_score": a.fault_score,
                    "confidence": a.confidence,
                    "reason_codes": a.reason_codes,
                }
            )
    return {
        "data": [{**_obs_out(o), "flags": flags.get(o.id, [])} for o in rows],
        "meta": {"limit": pagination.limit, "offset": pagination.offset, "total": total},
    }


@router.get("/{observation_id}")
async def get_observation(observation_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WeatherObservation).where(WeatherObservation.id == observation_id))
    obs = result.scalar_one_or_none()
    if obs is None:
        raise NotFoundError("Observation does not exist", code="OBSERVATION_NOT_FOUND")
    return {"data": _obs_out(obs)}
