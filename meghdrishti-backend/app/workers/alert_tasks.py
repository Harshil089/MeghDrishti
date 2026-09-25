"""Celery task to run ingestion for a station+source, off the request path."""
from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.repositories.station_repository import StationRepository
from app.services.ingestion_service import IngestionService
from app.workers.celery_app import celery_app

logger = get_logger("meghdrishti.workers.alert_tasks")


@celery_app.task(name="app.workers.alert_tasks.run_ingestion_for_station", bind=True, max_retries=3)
def run_ingestion_for_station(self, station_id: str, source: str, window_minutes: int = 20) -> dict:
    async def _run():
        async with AsyncSessionLocal() as session:
            station = await StationRepository(session).get(uuid.UUID(station_id))
            if station is None:
                return {"error": "station not found"}
            end = datetime.now(UTC)
            start = end - timedelta(minutes=window_minutes)
            return await IngestionService(session).run_for_station(station, source, start, end)

    try:
        return asyncio.run(_run())
    except Exception as exc:  # noqa: BLE001
        logger.error("ingestion_task_failed", station_id=station_id, source=source, error=str(exc))
        raise self.retry(exc=exc, countdown=min(120, 10 * 2**self.request.retries)) from exc
