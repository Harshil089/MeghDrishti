from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reviews import OperatorLabel, OperatorReview


class ReviewRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        anomaly_id: uuid.UUID,
        reviewer_id: uuid.UUID | None,
        previous_classification: str,
        operator_classification: str,
        comment: str | None,
        supporting_metadata: dict,
    ) -> OperatorReview:
        review = OperatorReview(
            anomaly_id=anomaly_id,
            reviewer_id=reviewer_id,
            previous_classification=previous_classification,
            operator_classification=operator_classification,
            comment=comment,
            supporting_metadata=supporting_metadata,
        )
        self.session.add(review)
        await self.session.flush()

        self.session.add(
            OperatorLabel(review_id=review.id, anomaly_id=anomaly_id, label=operator_classification)
        )
        await self.session.commit()
        await self.session.refresh(review)
        return review
