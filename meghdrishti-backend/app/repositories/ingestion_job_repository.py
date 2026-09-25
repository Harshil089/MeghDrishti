from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ingestion import IngestionJob, ReplayJob


class IngestionJobRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, source: str, station_id: uuid.UUID | None) -> IngestionJob:
        job = IngestionJob(
            source=source, station_id=station_id, status="RUNNING",
            started_at=datetime.now(UTC),
        )
        self.session.add(job)
        await self.session.commit()
        await self.session.refresh(job)
        return job

    async def mark_succeeded(self, job: IngestionJob, stats: dict) -> None:
        job.status = "SUCCEEDED"
        job.finished_at = datetime.now(UTC)
        job.stats = stats
        await self.session.commit()

    async def mark_failed(self, job: IngestionJob, error: str, stats: dict) -> None:
        job.status = "FAILED"
        job.finished_at = datetime.now(UTC)
        job.error_message = error[:2000]
        job.stats = stats
        await self.session.commit()

    async def get(self, job_id: uuid.UUID) -> IngestionJob | None:
        result = await self.session.execute(select(IngestionJob).where(IngestionJob.id == job_id))
        return result.scalar_one_or_none()

    async def list_jobs(self, limit: int, offset: int, status: str | None = None) -> list[IngestionJob]:
        stmt = select(IngestionJob).order_by(IngestionJob.created_at.desc()).limit(limit).offset(offset)
        if status:
            stmt = stmt.where(IngestionJob.status == status)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_replay(self, ingestion_job_id: uuid.UUID, requested_by: uuid.UUID | None) -> ReplayJob:
        replay = ReplayJob(ingestion_job_id=ingestion_job_id, status="PENDING", requested_by=requested_by)
        self.session.add(replay)
        await self.session.commit()
        await self.session.refresh(replay)
        return replay
