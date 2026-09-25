"""Periodic station health recomputation."""
from __future__ import annotations

import asyncio
import uuid

from app.db.session import AsyncSessionLocal
from app.repositories.station_repository import StationRepository
from app.services.health_service import HealthService
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.health_tasks.update_station_health")
def update_station_health(station_id: str) -> dict:
    async def _run():
        async with AsyncSessionLocal() as session:
            return await HealthService(session).recompute(uuid.UUID(station_id))

    return asyncio.run(_run())


@celery_app.task(name="app.workers.health_tasks.update_all_station_health")
def update_all_station_health() -> int:
    async def _run():
        async with AsyncSessionLocal() as session:
            stations = await StationRepository(session).all_active()
            for station in stations:
                await HealthService(session).recompute(station.id)
            return len(stations)

    return asyncio.run(_run())
