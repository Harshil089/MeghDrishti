"""Data sources, stations, sensors, and neighbor relationships."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class DataSource(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "data_sources"

    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # STATION_NETWORK / REANALYSIS / SATELLITE
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class Station(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "stations"

    station_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    elevation_m: Mapped[float] = mapped_column(Float, nullable=True)
    region: Mapped[str] = mapped_column(String(64), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    sensors: Mapped[list[StationSensor]] = relationship(
        back_populates="station", cascade="all, delete-orphan"
    )


class StationSensor(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "station_sensors"
    __table_args__ = (UniqueConstraint("station_id", "measurement", name="uq_station_sensor"),)

    station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False
    )
    measurement: Mapped[str] = mapped_column(String(64), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    installed_at: Mapped[str] = mapped_column(String(32), nullable=True)

    station: Mapped[Station] = relationship(back_populates="sensors")


class StationNeighbor(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "station_neighbors"
    __table_args__ = (
        UniqueConstraint("station_id", "neighbor_station_id", name="uq_station_neighbor"),
    )

    station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    neighbor_station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False
    )
    distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    elevation_delta_m: Mapped[float] = mapped_column(Float, nullable=True)
    correlation_score: Mapped[float] = mapped_column(Float, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
