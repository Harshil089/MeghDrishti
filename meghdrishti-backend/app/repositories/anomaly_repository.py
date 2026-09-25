from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.anomalies import Anomaly, AnomalyEvidence


class AnomalyRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        observation_id: uuid.UUID,
        station_id: uuid.UUID,
        classification: str,
        severity: str,
        fault_score: float,
        confidence: float,
        reason_codes: list[str],
        measurement: str | None,
        evidence: dict,
    ) -> Anomaly:
        anomaly = Anomaly(
            observation_id=observation_id,
            station_id=station_id,
            classification=classification,
            severity=severity,
            fault_score=fault_score,
            confidence=confidence,
            reason_codes=reason_codes,
            measurement=measurement,
        )
        self.session.add(anomaly)
        await self.session.flush()
        for source, payload in evidence.items():
            self.session.add(AnomalyEvidence(anomaly_id=anomaly.id, source=source, payload=payload))
        await self.session.commit()
        await self.session.refresh(anomaly)
        return anomaly

    async def get(self, anomaly_id: uuid.UUID) -> Anomaly | None:
        result = await self.session.execute(select(Anomaly).where(Anomaly.id == anomaly_id))
        return result.scalar_one_or_none()

    async def list(
        self,
        limit: int,
        offset: int,
        station_id: uuid.UUID | None = None,
        classification: str | None = None,
        severity: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> list[Anomaly]:
        stmt = select(Anomaly).order_by(Anomaly.created_at.desc()).limit(limit).offset(offset)
        if station_id:
            stmt = stmt.where(Anomaly.station_id == station_id)
        if classification:
            stmt = stmt.where(Anomaly.classification == classification)
        if severity:
            stmt = stmt.where(Anomaly.severity == severity)
        if start_time:
            stmt = stmt.where(Anomaly.created_at >= start_time)
        if end_time:
            stmt = stmt.where(Anomaly.created_at <= end_time)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def recent_for_station(self, station_id: uuid.UUID, limit: int = 50) -> list[Anomaly]:
        stmt = (
            select(Anomaly)
            .where(Anomaly.station_id == station_id)
            .order_by(Anomaly.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
