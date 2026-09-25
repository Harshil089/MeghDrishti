from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alerts import Alert


class AlertRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_dedup_key(self, dedup_key: str) -> Alert | None:
        result = await self.session.execute(select(Alert).where(Alert.dedup_key == dedup_key))
        return result.scalar_one_or_none()

    async def create(
        self,
        station_id: uuid.UUID,
        anomaly_id: uuid.UUID | None,
        priority: str,
        policy: str,
        dedup_key: str,
        title: str,
        details: dict,
    ) -> Alert:
        alert = Alert(
            station_id=station_id,
            anomaly_id=anomaly_id,
            status="OPEN",
            priority=priority,
            policy=policy,
            dedup_key=dedup_key,
            title=title,
            details=details,
        )
        self.session.add(alert)
        await self.session.commit()
        await self.session.refresh(alert)
        return alert

    async def get(self, alert_id: uuid.UUID) -> Alert | None:
        result = await self.session.execute(select(Alert).where(Alert.id == alert_id))
        return result.scalar_one_or_none()

    async def list(
        self, limit: int, offset: int, status: str | None = None, priority: str | None = None, station_id: uuid.UUID | None = None
    ) -> list[Alert]:
        stmt = select(Alert).order_by(Alert.created_at.desc()).limit(limit).offset(offset)
        if status:
            stmt = stmt.where(Alert.status == status)
        if priority:
            stmt = stmt.where(Alert.priority == priority)
        if station_id:
            stmt = stmt.where(Alert.station_id == station_id)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_status(self, alert: Alert, status: str, acknowledged_by: uuid.UUID | None = None) -> Alert:
        alert.status = status
        if acknowledged_by:
            alert.acknowledged_by = acknowledged_by
        await self.session.commit()
        await self.session.refresh(alert)
        return alert
