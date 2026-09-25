"""Context-fetch retry task — external providers fail; failures must not lose observations."""
from __future__ import annotations

import asyncio
import uuid

from app.core.logging import get_logger
from app.db.session import AsyncSessionLocal
from app.workers.celery_app import celery_app
from app.workers.pipeline import run_context_validation

logger = get_logger("meghdrishti.workers.context_tasks")


@celery_app.task(name="app.workers.context_tasks.retry_context_fetch", bind=True, max_retries=5)
def retry_context_fetch(self, observation_id: str) -> None:
    async def _run():
        async with AsyncSessionLocal() as session:
            await run_context_validation(session, uuid.UUID(observation_id))

    try:
        asyncio.run(_run())
    except Exception as exc:  # noqa: BLE001
        logger.warning("context_fetch_retry", observation_id=observation_id, attempt=self.request.retries, error=str(exc))
        raise self.retry(exc=exc, countdown=min(300, 5 * 2**self.request.retries)) from exc
