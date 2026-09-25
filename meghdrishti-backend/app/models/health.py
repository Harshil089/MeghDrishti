"""Station-level health scoring, independent of individual anomaly decisions."""
from __future__ import annotations

import uuid

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class StationHealth(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "station_health"

    station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("stations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    health_score: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    # HEALTHY / DEGRADED / POOR / CRITICAL
    issues: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    components: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
