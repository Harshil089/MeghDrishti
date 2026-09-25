from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.observations import ObservationFeatures


class FeatureRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_observation(self, observation_id: uuid.UUID) -> ObservationFeatures | None:
        result = await self.session.execute(
            select(ObservationFeatures).where(ObservationFeatures.observation_id == observation_id)
        )
        return result.scalar_one_or_none()

    async def upsert(
        self, observation_id: uuid.UUID, station_id: uuid.UUID, features: dict, completeness_pct: float
    ) -> ObservationFeatures:
        existing = await self.get_by_observation(observation_id)
        if existing:
            existing.features = features
            existing.completeness_pct = completeness_pct
        else:
            existing = ObservationFeatures(
                observation_id=observation_id,
                station_id=station_id,
                features=features,
                completeness_pct=completeness_pct,
            )
            self.session.add(existing)
        await self.session.commit()
        return existing
