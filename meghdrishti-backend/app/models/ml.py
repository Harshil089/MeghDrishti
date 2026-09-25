"""ML model registry."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class ModelVersion(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "model_versions"

    model_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    model_version: Mapped[str] = mapped_column(String(32), nullable=False)
    measurement: Mapped[str] = mapped_column(String(64), nullable=False)
    region: Mapped[str] = mapped_column(String(64), nullable=True)
    season: Mapped[str] = mapped_column(String(16), nullable=True)
    feature_names: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    training_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    training_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    contamination: Mapped[float] = mapped_column(Float, nullable=False, default=0.05)
    threshold: Mapped[float] = mapped_column(Float, nullable=True)
    metrics: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    artifact_path: Mapped[str] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="CANDIDATE", nullable=False)
    # CANDIDATE / ACTIVE / RETIRED / FAILED


class ModelMetric(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "model_metrics"

    model_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("model_versions.id", ondelete="CASCADE"), nullable=False
    )
    metric_name: Mapped[str] = mapped_column(String(64), nullable=False)
    metric_value: Mapped[float] = mapped_column(Float, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
