from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Pagination, pagination_params
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.anomalies import Anomaly
from app.repositories.anomaly_repository import AnomalyRepository

router = APIRouter()


def _anomaly_out(a: Anomaly) -> dict:
    return {
        "id": str(a.id),
        "observation_id": str(a.observation_id),
        "station_id": str(a.station_id),
        "classification": a.classification,
        "severity": a.severity,
        "fault_score": a.fault_score,
        "confidence": a.confidence,
        "reason_codes": a.reason_codes,
        "measurement": a.measurement,
        "created_at": a.created_at.isoformat(),
    }


@router.get("")
async def list_anomalies(
    station_id: uuid.UUID | None = None,
    classification: str | None = None,
    severity: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    pagination: Pagination = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    repo = AnomalyRepository(db)
    anomalies = await repo.list(
        pagination.limit, pagination.offset, station_id, classification, severity, start_time, end_time
    )
    return {"data": [_anomaly_out(a) for a in anomalies], "meta": {"limit": pagination.limit, "offset": pagination.offset}}


@router.get("/{anomaly_id}")
async def get_anomaly(anomaly_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = AnomalyRepository(db)
    anomaly = await repo.get(anomaly_id)
    if anomaly is None:
        raise NotFoundError("Anomaly does not exist", code="ANOMALY_NOT_FOUND")
    return {"data": _anomaly_out(anomaly)}
