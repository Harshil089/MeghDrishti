from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Pagination, pagination_params
from app.core.exceptions import NotFoundError
from app.core.permissions import Permission, require_permission
from app.db.session import get_db
from app.models.alerts import Alert
from app.repositories.alert_repository import AlertRepository
from app.services.event_publisher import publish_alert_event

router = APIRouter()


class AlertStatusUpdate(BaseModel):
    status: str


def _alert_out(a: Alert) -> dict:
    return {
        "id": str(a.id),
        "station_id": str(a.station_id),
        "anomaly_id": str(a.anomaly_id) if a.anomaly_id else None,
        "status": a.status,
        "priority": a.priority,
        "policy": a.policy,
        "title": a.title,
        "details": a.details,
        "created_at": a.created_at.isoformat(),
    }


@router.get("")
async def list_alerts(
    status: str | None = None,
    priority: str | None = None,
    station_id: uuid.UUID | None = None,
    pagination: Pagination = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    repo = AlertRepository(db)
    alerts = await repo.list(pagination.limit, pagination.offset, status, priority, station_id)
    return {"data": [_alert_out(a) for a in alerts], "meta": {"limit": pagination.limit, "offset": pagination.offset}}


@router.get("/{alert_id}")
async def get_alert(alert_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = AlertRepository(db)
    alert = await repo.get(alert_id)
    if alert is None:
        raise NotFoundError("Alert does not exist", code="ALERT_NOT_FOUND")
    return {"data": _alert_out(alert)}


@router.patch("/{alert_id}")
async def update_alert(
    alert_id: uuid.UUID,
    payload: AlertStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission(Permission.ACKNOWLEDGE_ALERT)),
):
    repo = AlertRepository(db)
    alert = await repo.get(alert_id)
    if alert is None:
        raise NotFoundError("Alert does not exist", code="ALERT_NOT_FOUND")
    ack_by = uuid.UUID(user.id) if payload.status == "ACKNOWLEDGED" else None
    alert = await repo.update_status(alert, payload.status, ack_by)
    await publish_alert_event("ALERT_UPDATED", {"alert_id": str(alert.id), "status": alert.status})
    return {"data": _alert_out(alert)}
