from __future__ import annotations

from typing import Literal

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.explanation import explain
from app.api.deps import Pagination, pagination_params
from app.core.exceptions import NotFoundError
from app.core.permissions import Permission, require_permission
from app.db.session import get_db
from app.models.alerts import Alert
from app.models.anomalies import Anomaly, AnomalyEvidence
from app.models.ingestion import RawObservation
from app.models.observations import WeatherObservation
from app.repositories.alert_repository import AlertRepository
from app.services.event_publisher import publish_alert_event

router = APIRouter()


class AlertStatusUpdate(BaseModel):
    status: Literal["OPEN", "ACKNOWLEDGED", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]


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
        "observed_at": None,
        "received_at": None,
        "detected_at": a.created_at.isoformat(),
    }


async def _with_explanations(db: AsyncSession, alerts: list[Alert]) -> list[dict]:
    ids = {a.anomaly_id for a in alerts if a.anomaly_id}
    records = {}
    evidence = {}
    if ids:
        rows = await db.execute(
            select(Anomaly, WeatherObservation, RawObservation.raw_payload)
            .outerjoin(WeatherObservation, WeatherObservation.id == Anomaly.observation_id)
            .outerjoin(RawObservation, RawObservation.id == WeatherObservation.raw_observation_id)
            .where(Anomaly.id.in_(ids))
        )
        records = {a.id: (a, obs, payload) for a, obs, payload in rows.all()}
        rows = await db.execute(select(AnomalyEvidence).where(AnomalyEvidence.anomaly_id.in_(ids)))
        for row in rows.scalars():
            evidence.setdefault(row.anomaly_id, {})[row.source] = row.payload
    output = []
    for alert in alerts:
        item = _alert_out(alert)
        if alert.anomaly_id in records:
            anomaly, observation, payload = records[alert.anomaly_id]
            item["detected_at"] = anomaly.created_at.isoformat()
            if observation:
                item["observed_at"] = observation.timestamp.isoformat()
                item["received_at"] = observation.received_at.isoformat()
            item["explanation"] = explain(anomaly, observation, evidence.get(anomaly.id, {}), payload)
            if alert.policy in {"ANOMALY_BURST", "CONSECUTIVE_SUSPICIOUS"}:
                item["explanation"]["summary"] = "Latest flagged reading — " + item["explanation"]["summary"]
        output.append(item)
    return output


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
    return {"data": await _with_explanations(db, alerts), "meta": {"limit": pagination.limit, "offset": pagination.offset}}


@router.get("/{alert_id}")
async def get_alert(alert_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = AlertRepository(db)
    alert = await repo.get(alert_id)
    if alert is None:
        raise NotFoundError("Alert does not exist", code="ALERT_NOT_FOUND")
    item = (await _with_explanations(db, [alert]))[0]
    if alert.anomaly_id and alert.policy in {"ANOMALY_BURST", "CONSECUTIVE_SUSPICIOUS"}:
        current = await db.get(Anomaly, alert.anomaly_id)
        observation = await db.get(WeatherObservation, current.observation_id) if current else None
        if current and observation:
            recent = (await db.execute(
                select(Anomaly, WeatherObservation.timestamp)
                .join(WeatherObservation, WeatherObservation.id == Anomaly.observation_id)
                .where(Anomaly.station_id == alert.station_id,
                       WeatherObservation.timestamp <= observation.timestamp,
                       WeatherObservation.source == observation.source)
                .order_by(WeatherObservation.timestamp.desc(), Anomaly.created_at.desc()).limit(20)
            )).all()
            members = []
            for anomaly, event_at in recent:
                if alert.policy == "ANOMALY_BURST":
                    if event_at < observation.timestamp - timedelta(minutes=30) or anomaly.classification == "NORMAL":
                        continue
                elif anomaly.classification not in {"SUSPICIOUS", "PROBABLE_SENSOR_FAULT"}:
                    break
                members.append(anomaly)
            ids = {a.id for a in members}
            evidence = {}
            rows = await db.execute(select(AnomalyEvidence).where(AnomalyEvidence.anomaly_id.in_(ids)))
            for row in rows.scalars():
                evidence.setdefault(row.anomaly_id, {})[row.source] = row.payload
            rows = await db.execute(
                select(WeatherObservation, RawObservation.raw_payload)
                .outerjoin(RawObservation, RawObservation.id == WeatherObservation.raw_observation_id)
                .where(WeatherObservation.id.in_({a.observation_id for a in members}))
            )
            observations = {obs.id: (obs, payload) for obs, payload in rows.all()}
            item["explanation"]["related_readings"] = [
                {"anomaly_id": str(a.id), **explain(a, observations.get(a.observation_id, (None, None))[0],
                   evidence.get(a.id, {}), observations.get(a.observation_id, (None, None))[1])}
                for a in members
            ]
            item["explanation"]["group_note"] = "Reconstructed by observation time and source, up to 20 readings. Legacy alert counts may differ because they used processing-time windows."
    return {"data": item}


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
    return {"data": (await _with_explanations(db, [alert]))[0]}
