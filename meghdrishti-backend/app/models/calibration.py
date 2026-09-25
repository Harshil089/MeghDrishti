"""Calibration profiles storing configurable rule thresholds and fusion weights."""
from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class CalibrationProfile(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "calibration_profiles"

    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rule_thresholds: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    fusion_weights: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    decision_thresholds: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    health_weights: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    health_boundaries: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
