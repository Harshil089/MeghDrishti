"""Celery entry point for the realtime observation processing pipeline."""
from __future__ import annotations

import asyncio
import uuid

from app.core.logging import get_logger
from app.workers.celery_app import celery_app
from app.workers.pipeline import process_observation

logger = get_logger("meghdrishti.workers.qc_tasks")


@celery_app.task(name="app.workers.qc_tasks.process_observation_task", bind=True, max_retries=3)
def process_observation_task(self, observation_id: str) -> str | None:
    try:
        anomaly_id = asyncio.run(process_observation(uuid.UUID(observation_id)))
        return str(anomaly_id) if anomaly_id else None
    except Exception as exc:  # noqa: BLE001
        logger.error("process_observation_failed", observation_id=observation_id, error=str(exc))
        raise self.retry(exc=exc, countdown=min(60, 2**self.request.retries)) from exc
