"""Independently persisted rule / ML / context evidence outputs."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class QCRuleResult(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "qc_rule_results"

    observation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("weather_observations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rule: Mapped[str] = mapped_column(String(64), nullable=False)
    triggered: Mapped[bool] = mapped_column(Boolean, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    reason_code: Mapped[str] = mapped_column(String(64), nullable=True)
    evidence: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class MLResult(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "ml_results"

    observation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("weather_observations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("model_versions.id", ondelete="SET NULL"), nullable=True
    )
    raw_score: Mapped[float] = mapped_column(Float, nullable=False)
    normalized_anomaly_score: Mapped[float] = mapped_column(Float, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    is_anomalous: Mapped[bool] = mapped_column(Boolean, nullable=False)
    features_used: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class ContextResult(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "context_results"

    observation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("weather_observations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    spatial_consistency: Mapped[float] = mapped_column(Float, nullable=True)
    forecast_consistency: Mapped[float] = mapped_column(Float, nullable=True)
    era5_consistency: Mapped[float] = mapped_column(Float, nullable=True)
    gpm_consistency: Mapped[float] = mapped_column(Float, nullable=True)
    external_context_available: Mapped[bool] = mapped_column(Boolean, nullable=False)
    extreme_weather_score: Mapped[float] = mapped_column(Float, nullable=True)
    evidence: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
