"""Canonical normalized observations and derived engineered features."""
from __future__ import annotations

import uuid

from sqlalchemy import DateTime, Float, ForeignKey, Index, String, desc
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class WeatherObservation(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "weather_observations"
    __table_args__ = (
        Index(
            "ix_weather_observations_station_timestamp",
            "station_id",
            desc("timestamp"),
        ),
    )

    station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False
    )
    raw_observation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("raw_observations.id", ondelete="SET NULL"), nullable=True
    )
    timestamp: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)

    temperature_c: Mapped[float] = mapped_column(Float, nullable=True)
    humidity_pct: Mapped[float] = mapped_column(Float, nullable=True)
    pressure_hpa: Mapped[float] = mapped_column(Float, nullable=True)
    rainfall_mm: Mapped[float] = mapped_column(Float, nullable=True)
    wind_speed_ms: Mapped[float] = mapped_column(Float, nullable=True)
    wind_direction_deg: Mapped[float] = mapped_column(Float, nullable=True)

    received_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)


class ObservationFeatures(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "observation_features"

    observation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("weather_observations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False
    )
    features: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    completeness_pct: Mapped[float] = mapped_column(Float, nullable=True)
