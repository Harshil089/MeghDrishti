from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calibration import CalibrationProfile


class CalibrationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_active(self) -> CalibrationProfile | None:
        result = await self.session.execute(
            select(CalibrationProfile).where(CalibrationProfile.is_active.is_(True)).limit(1)
        )
        return result.scalar_one_or_none()
