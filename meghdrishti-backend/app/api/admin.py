from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Pagination, pagination_params
from app.core.exceptions import NotFoundError
from app.core.permissions import Permission, require_permission
from app.db.session import get_db
from app.repositories.ingestion_job_repository import IngestionJobRepository
from app.repositories.station_repository import StationRepository
from app.services.ingestion_service import IngestionService

router = APIRouter()


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
