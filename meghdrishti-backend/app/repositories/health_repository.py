from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health import StationHealth


class HealthRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_latest(self, station_id: uuid.UUID) -> StationHealth | None:
        result = await self.session.execute(select(StationHealth).where(StationHealth.station_id == station_id))
        return result.scalar_one_or_none()

    async def upsert(
        self, station_id: uuid.UUID, health_score: float, status: str, issues: list[str], components: dict
    ) -> StationHealth:
        existing = await self.get_latest(station_id)
        if existing:
            existing.health_score = health_score
            existing.status = status
            existing.issues = issues
            existing.components = components
        else:
            existing = StationHealth(
                station_id=station_id, health_score=health_score, status=status, issues=issues, components=components
            )
            self.session.add(existing)
        await self.session.commit()
        await self.session.refresh(existing)
        return existing

    async def list_all(self) -> list[StationHealth]:
        result = await self.session.execute(select(StationHealth))
        return list(result.scalars().all())
