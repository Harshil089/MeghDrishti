from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.context.engine import ContextResultData
from app.models.qc import ContextResult


class ContextRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, observation_id: uuid.UUID, data: ContextResultData) -> ContextResult:
        row = ContextResult(
            observation_id=observation_id,
            spatial_consistency=data.spatial_consistency,
            forecast_consistency=data.forecast_consistency,
            era5_consistency=data.era5_consistency,
            gpm_consistency=data.gpm_consistency,
            external_context_available=data.external_context_available,
            extreme_weather_score=data.extreme_weather_score,
            evidence=data.evidence,
        )
        self.session.add(row)
        await self.session.commit()
        return row
