from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stations import Station, StationNeighbor


class StationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, station_id: uuid.UUID) -> Station | None:
        result = await self.session.execute(select(Station).where(Station.id == station_id))
        return result.scalar_one_or_none()

    async def get_by_code(self, station_code: str) -> Station | None:
        result = await self.session.execute(select(Station).where(Station.station_code == station_code))
        return result.scalar_one_or_none()

    async def list(self, limit: int, offset: int, region: str | None = None, is_active: bool | None = None) -> list[Station]:
        stmt = select(Station).order_by(Station.station_code).limit(limit).offset(offset)
        if region:
            stmt = stmt.where(Station.region == region)
        if is_active is not None:
            stmt = stmt.where(Station.is_active == is_active)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, **kwargs) -> Station:
        station = Station(**kwargs)
        self.session.add(station)
        await self.session.commit()
        await self.session.refresh(station)
        return station

    async def update(self, station: Station, **kwargs) -> Station:
        for k, v in kwargs.items():
            if v is not None:
                setattr(station, k, v)
        await self.session.commit()
        await self.session.refresh(station)
        return station

    async def all_active(self) -> list[Station]:
        result = await self.session.execute(select(Station).where(Station.is_active.is_(True)))
        return list(result.scalars().all())

    async def neighbors_of(self, station_id: uuid.UUID) -> list[StationNeighbor]:
        result = await self.session.execute(
            select(StationNeighbor)
            .where(StationNeighbor.station_id == station_id)
            .order_by(StationNeighbor.priority)
        )
        return list(result.scalars().all())

    async def replace_neighbors(self, station_id: uuid.UUID, neighbors: list[dict]) -> None:
        existing = await self.neighbors_of(station_id)
        for n in existing:
            await self.session.delete(n)
        await self.session.flush()
        for n in neighbors:
            self.session.add(StationNeighbor(station_id=station_id, **n))
        await self.session.commit()
