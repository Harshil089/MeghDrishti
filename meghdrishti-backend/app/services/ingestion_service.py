"""Orchestrates ingestion runs with job tracking so failed pulls are never silently lost."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.ingestion.manager import get_adapter_registry, ingest_station
from app.models.stations import Station
from app.repositories.ingestion_job_repository import IngestionJobRepository

logger = get_logger("meghdrishti.services.ingestion")


class IngestionService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.jobs = IngestionJobRepository(session)

    async def run_for_station(
        self, station: Station, source: str, start_time: datetime, end_time: datetime
    ) -> dict:
        registry = get_adapter_registry()
        adapter = registry.get(source)
        if adapter is None:
            raise ValueError(f"Unknown ingestion source: {source}")

        job = await self.jobs.create(source=source, station_id=station.id)
        try:
            result = await ingest_station(self.session, station, adapter, start_time, end_time, job.id)
            stats = {
                "fetched": result.fetched,
                "raw_stored": result.raw_stored,
                "duplicates": result.duplicates,
                "schema_invalid": result.schema_invalid,
                "normalized": result.normalized,
                "errors": result.errors,
            }
            if result.errors and result.raw_stored == 0:
                await self.jobs.mark_failed(job, "; ".join(result.errors), stats)
            else:
                await self.jobs.mark_succeeded(job, stats)
            return {"job_id": str(job.id), **stats}
        except Exception as exc:  # noqa: BLE001
            await self.jobs.mark_failed(job, str(exc), {})
            logger.error("ingestion_run_failed", station=station.station_code, source=source, error=str(exc))
            raise

    async def replay(self, ingestion_job_id: uuid.UUID, station: Station, requested_by: uuid.UUID | None) -> dict:
        job = await self.jobs.get(ingestion_job_id)
        if job is None:
            raise ValueError("Ingestion job not found")
        await self.jobs.create_replay(ingestion_job_id, requested_by)
        window_end = job.created_at or datetime.now(UTC)
        window_start = window_end
        return await self.run_for_station(station, job.source, window_start, window_end)
