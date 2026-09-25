"""Persistence for raw + normalized observations, with idempotent writes."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ingestion import RawObservation
from app.models.observations import WeatherObservation


class ObservationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_raw_by_hash(self, payload_hash: str) -> RawObservation | None:
        result = await self.session.execute(
            select(RawObservation).where(RawObservation.payload_hash == payload_hash)
        )
        return result.scalar_one_or_none()

    async def create_raw(
        self,
        source: str,
        station_id: uuid.UUID | None,
        source_timestamp: datetime | None,
        received_at: datetime,
        raw_payload: dict,
        payload_hash: str,
        ingestion_job_id: uuid.UUID | None,
    ) -> RawObservation:
        raw = RawObservation(
            source=source,
            station_id=station_id,
            source_timestamp=source_timestamp,
            received_at=received_at,
            raw_payload=raw_payload,
            payload_hash=payload_hash,
            ingestion_job_id=ingestion_job_id,
            processing_status="RECEIVED",
        )
        self.session.add(raw)
        await self.session.flush()
        return raw

    async def get_normalized(
        self, station_id: uuid.UUID, timestamp: datetime, source: str
    ) -> WeatherObservation | None:
        result = await self.session.execute(
            select(WeatherObservation).where(
                WeatherObservation.station_id == station_id,
                WeatherObservation.timestamp == timestamp,
                WeatherObservation.source == source,
            )
        )
        return result.scalar_one_or_none()

    async def create_normalized(
        self,
        station_id: uuid.UUID,
        raw_observation_id: uuid.UUID | None,
        timestamp: datetime,
        source: str,
        measurements: dict,
        received_at: datetime,
    ) -> WeatherObservation:
        obs = WeatherObservation(
            station_id=station_id,
            raw_observation_id=raw_observation_id,
            timestamp=timestamp,
            source=source,
            received_at=received_at,
            **measurements,
        )
        self.session.add(obs)
        await self.session.flush()
        return obs

    async def recent_for_station(
        self, station_id: uuid.UUID, before: datetime, limit: int = 200
    ) -> list[WeatherObservation]:
        result = await self.session.execute(
            select(WeatherObservation)
            .where(WeatherObservation.station_id == station_id, WeatherObservation.timestamp <= before)
            .order_by(WeatherObservation.timestamp.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_for_station(
        self, station_id: uuid.UUID, limit: int, offset: int
    ) -> list[WeatherObservation]:
        result = await self.session.execute(
            select(WeatherObservation)
            .where(WeatherObservation.station_id == station_id)
            .order_by(WeatherObservation.timestamp.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())
