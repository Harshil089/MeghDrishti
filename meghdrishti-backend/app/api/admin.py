from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Pagination, pagination_params
from app.core.exceptions import NotFoundError
from app.core.permissions import Permission, require_permission
from app.db.session import get_db
from app.ingestion.ghcn_stations import refresh_india_stations
from app.models.calibration import CalibrationProfile
from app.models.ingestion import RawObservation
from app.models.observations import WeatherObservation
from app.models.reviews import OperatorReview
from app.models.stations import DataSource
from app.qc.defaults import DEFAULT_RULE_THRESHOLDS
from app.repositories.calibration_repository import CalibrationRepository
from app.repositories.ingestion_job_repository import IngestionJobRepository
from app.repositories.station_repository import StationRepository
from app.scoring.defaults import DEFAULT_DECISION_THRESHOLDS, DEFAULT_FUSION_WEIGHTS
from app.services.ingestion_service import IngestionService
from app.workers.qc_tasks import process_observation_task

router = APIRouter()


@router.post("/ghcn-stations/refresh")
async def refresh_ghcn_stations(_user=Depends(require_permission(Permission.MANAGE_SOURCES))):
    return {"data": {"stations": await refresh_india_stations()}}


@router.post("/calibration/propose")
async def propose_calibration(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MANAGE_CALIBRATION)),
):
    now = datetime.now(UTC)
    result = await db.execute(
        select(OperatorReview.operator_classification, func.count())
        .where(OperatorReview.created_at >= now - timedelta(days=30))
        .group_by(OperatorReview.operator_classification)
    )
    label_counts = {row[0]: row[1] for row in result.all()}
    total = sum(label_counts.values())
    false_positive_rate = label_counts.get("FALSE_POSITIVE", 0) / max(total, 1)
    thresholds = dict(DEFAULT_DECISION_THRESHOLDS)
    if false_positive_rate > 0.3:
        thresholds["WATCH"] = min(0.5, thresholds["WATCH"] + 0.05)
        thresholds["SUSPICIOUS"] = min(0.7, thresholds["SUSPICIOUS"] + 0.05)
    elif false_positive_rate < 0.05 and total >= 20:
        thresholds["WATCH"] = max(0.15, thresholds["WATCH"] - 0.05)
    profile = CalibrationProfile(
        name=f"auto-calibration-{now:%Y%m%d}", is_active=False,
        rule_thresholds=DEFAULT_RULE_THRESHOLDS, fusion_weights=DEFAULT_FUSION_WEIGHTS,
        decision_thresholds=thresholds, health_weights={}, health_boundaries={},
    )
    db.add(profile)
    await db.commit()
    return {"data": {"profile_id": str(profile.id), "false_positive_rate": false_positive_rate, "label_counts": label_counts}}


@router.get("/calibration")
async def get_active_calibration(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MANAGE_CALIBRATION)),
):
    profile = await CalibrationRepository(db).get_active()
    if profile is None:
        return {"data": None, "meta": {"message": "No active calibration profile — running on hardcoded defaults"}}
    return {
        "data": {
            "id": str(profile.id),
            "name": profile.name,
            "is_active": profile.is_active,
            "rule_thresholds": profile.rule_thresholds,
            "fusion_weights": profile.fusion_weights,
            "decision_thresholds": profile.decision_thresholds,
            "health_weights": profile.health_weights,
            "health_boundaries": profile.health_boundaries,
            "updated_at": profile.updated_at.isoformat(),
        }
    }


@router.get("/data-sources")
async def list_data_sources(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MANAGE_SOURCES)),
):
    rows = (await db.execute(select(DataSource))).scalars().all()
    return {
        "data": [
            {"name": s.name, "kind": s.kind, "is_enabled": s.is_enabled, "config": s.config}
            for s in rows
        ]
    }


@router.post("/ingest/{station_id}")
async def trigger_ingestion(
    station_id: uuid.UUID,
    source: str = "OPEN_METEO",
    window_minutes: int = Query(60, ge=1, le=525600),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MANAGE_REPLAY)),
):
    station = await StationRepository(db).get(station_id)
    if station is None:
        raise NotFoundError("Station not found", code="STATION_NOT_FOUND")
    end = datetime.now(UTC)
    start = end - timedelta(minutes=window_minutes)
    result = await IngestionService(db).run_for_station(station, source, start, end)
    return {"data": result}


@router.get("/ingestion-jobs")
async def list_ingestion_jobs(
    status: str | None = None,
    pagination: Pagination = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MANAGE_REPLAY)),
):
    repo = IngestionJobRepository(db)
    jobs = await repo.list_jobs(pagination.limit, pagination.offset, status)
    return {
        "data": [
            {
                "id": str(j.id),
                "source": j.source,
                "station_id": str(j.station_id) if j.station_id else None,
                "status": j.status,
                "attempt": j.attempt,
                "error_message": j.error_message,
                "stats": j.stats,
                "created_at": j.created_at.isoformat(),
            }
            for j in jobs
        ],
        "meta": {"limit": pagination.limit, "offset": pagination.offset},
    }


class EnqueueProcessingRequest(BaseModel):
    job_ids: list[uuid.UUID]


@router.post("/enqueue-processing")
async def enqueue_processing(
    body: EnqueueProcessingRequest,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MANAGE_REPLAY)),
) -> dict:
    """Hand normalized observations from the given ingestion jobs to the
    realtime Celery pipeline. Exists so the Airflow DAG (a separate Python
    environment with its own, older, pinned SQLAlchemy) can trigger this
    without importing any app.* modules directly — it just calls this
    endpoint over HTTP instead."""
    result = await db.execute(
        select(WeatherObservation.id)
        .join(RawObservation, RawObservation.id == WeatherObservation.raw_observation_id)
        .where(RawObservation.ingestion_job_id.in_(body.job_ids))
    )
    observation_ids = [str(row[0]) for row in result.all()]
    for observation_id in observation_ids:
        process_observation_task.delay(observation_id)
    return {"data": {"enqueued": len(observation_ids)}}


@router.post("/replay/{job_id}")
async def replay_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission(Permission.MANAGE_REPLAY)),
):
    job_repo = IngestionJobRepository(db)
    job = await job_repo.get(job_id)
    if job is None or job.station_id is None:
        raise NotFoundError("Ingestion job not found or has no associated station")

    station_repo = StationRepository(db)
    station = await station_repo.get(job.station_id)
    if station is None:
        raise NotFoundError("Station not found")

    service = IngestionService(db)
    result = await service.replay(job_id, station, uuid.UUID(user.id))
    return {"data": result}
