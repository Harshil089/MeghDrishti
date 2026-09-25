"""Raw observation preservation + ingestion/replay job tracking."""
from __future__ import annotations

import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin


class IngestionJob(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "ingestion_jobs"

    source: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    # PENDING / RUNNING / SUCCEEDED / FAILED
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    started_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str] = mapped_column(String(2000), nullable=True)
    stats: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class RawObservation(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "raw_observations"

    source: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source_timestamp: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    ingestion_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ingestion_jobs.id", ondelete="SET NULL"), nullable=True
    )
    schema_valid: Mapped[bool] = mapped_column(nullable=True)
    processing_status: Mapped[str] = mapped_column(String(32), default="RECEIVED", nullable=False)
    # RECEIVED / VALIDATED / NORMALIZED / REJECTED / PROCESSED
    error_message: Mapped[str] = mapped_column(String(2000), nullable=True)


class ReplayJob(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "replay_jobs"

    ingestion_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ingestion_jobs.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    requested_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    result: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
