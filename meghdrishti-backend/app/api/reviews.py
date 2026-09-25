from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import Permission, require_permission
from app.db.session import get_db
from app.services.review_service import ReviewService

router = APIRouter()


class ReviewCreate(BaseModel):
    operator_classification: str
    comment: str | None = None
    supporting_metadata: dict = {}


@router.post("/anomalies/{anomaly_id}/review")
async def submit_review(
    anomaly_id: uuid.UUID,
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_permission(Permission.SUBMIT_REVIEW)),
):
    service = ReviewService(db)
    review = await service.submit_review(
        anomaly_id=anomaly_id,
        reviewer_id=uuid.UUID(user.id),
        operator_classification=payload.operator_classification,
        comment=payload.comment,
        supporting_metadata=payload.supporting_metadata,
    )
    return {
        "data": {
            "id": str(review.id),
            "anomaly_id": str(review.anomaly_id),
            "previous_classification": review.previous_classification,
            "operator_classification": review.operator_classification,
            "comment": review.comment,
            "created_at": review.created_at.isoformat(),
        }
    }
