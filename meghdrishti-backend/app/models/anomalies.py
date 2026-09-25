"""Anomaly decisions and their supporting evidence bundle."""
from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class Anomaly(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "anomalies"

    observation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("weather_observations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    classification: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # NORMAL / WATCH / SUSPICIOUS / PROBABLE_SENSOR_FAULT / LIKELY_GENUINE_EXTREME / INSUFFICIENT_CONTEXT
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    fault_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    reason_codes: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    measurement: Mapped[str] = mapped_column(String(64), nullable=True)


class AnomalyEvidence(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "anomaly_evidence"

    anomaly_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("anomalies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(String(32), nullable=False)  # RULE / ML / CONTEXT / NEIGHBOR
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
