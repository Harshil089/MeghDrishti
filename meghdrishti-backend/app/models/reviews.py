"""Operator reviews and the resulting labels used for calibration."""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class OperatorReview(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "operator_reviews"

    anomaly_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("anomalies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    previous_classification: Mapped[str] = mapped_column(String(32), nullable=False)
    operator_classification: Mapped[str] = mapped_column(String(32), nullable=False)
    # CONFIRMED_SENSOR_FAULT / VALID_EXTREME_WEATHER / FALSE_POSITIVE / UNKNOWN / REVIEW_LATER
    comment: Mapped[str] = mapped_column(Text, nullable=True)
    supporting_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class OperatorLabel(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "operator_labels"

    review_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("operator_reviews.id", ondelete="CASCADE"), nullable=False, index=True
    )
    anomaly_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("anomalies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(32), nullable=False)
    used_in_calibration: Mapped[bool] = mapped_column(default=False, nullable=False)
