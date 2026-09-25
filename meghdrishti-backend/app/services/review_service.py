"""Operator review submission: creates the review, its label, and an audit record."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.repositories.anomaly_repository import AnomalyRepository
from app.repositories.audit_repository import AuditRepository
from app.repositories.review_repository import ReviewRepository
from app.services.event_publisher import publish_dashboard_event

VALID_CLASSIFICATIONS = {
    "CONFIRMED_SENSOR_FAULT",
    "VALID_EXTREME_WEATHER",
    "FALSE_POSITIVE",
    "UNKNOWN",
    "REVIEW_LATER",
}


class ReviewService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.anomalies = AnomalyRepository(session)
        self.reviews = ReviewRepository(session)
        self.audit = AuditRepository(session)

    async def submit_review(
        self,
        anomaly_id: uuid.UUID,
        reviewer_id: uuid.UUID | None,
        operator_classification: str,
        comment: str | None,
        supporting_metadata: dict | None = None,
    ):
        if operator_classification not in VALID_CLASSIFICATIONS:
            raise ValueError(f"Invalid operator classification: {operator_classification}")

        anomaly = await self.anomalies.get(anomaly_id)
        if anomaly is None:
            raise NotFoundError("Anomaly does not exist", code="ANOMALY_NOT_FOUND")

        review = await self.reviews.create(
            anomaly_id=anomaly_id,
            reviewer_id=reviewer_id,
            previous_classification=anomaly.classification,
            operator_classification=operator_classification,
            comment=comment,
            supporting_metadata=supporting_metadata or {},
        )

        await self.audit.log(
            actor_id=reviewer_id,
            action="review_created",
            entity_type="anomaly",
            entity_id=str(anomaly_id),
            before={"classification": anomaly.classification},
            after={"operator_classification": operator_classification},
        )

        await publish_dashboard_event(
            "REVIEW_COMPLETED",
            {"anomaly_id": str(anomaly_id), "operator_classification": operator_classification},
        )

        return review
