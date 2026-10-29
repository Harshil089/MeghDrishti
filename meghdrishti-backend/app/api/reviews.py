from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Pagination, pagination_params
from app.core.permissions import Permission, require_permission
from app.db.session import get_db
from app.models.anomalies import Anomaly
from app.models.reviews import OperatorReview
from app.models.stations import Station
from app.models.users import User
from app.services.review_service import ReviewService

router = APIRouter()


class ReviewCreate(BaseModel):
    operator_classification: Literal[
        "CONFIRMED_SENSOR_FAULT", "VALID_EXTREME_WEATHER", "FALSE_POSITIVE", "UNKNOWN", "REVIEW_LATER"
    ]
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


@router.get("/reviews")
async def list_reviews(
    pagination: Pagination = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    """Operator verdicts, newest first, with the station and reviewer they belong to."""
    rows = (
        await db.execute(
            select(OperatorReview, Anomaly, Station.name, User.email)
            .join(Anomaly, Anomaly.id == OperatorReview.anomaly_id)
            .join(Station, Station.id == Anomaly.station_id)
            .outerjoin(User, User.id == OperatorReview.reviewer_id)
            .order_by(OperatorReview.created_at.desc())
            .limit(pagination.limit)
            .offset(pagination.offset)
        )
    ).all()
    total = (await db.execute(select(func.count()).select_from(OperatorReview))).scalar_one()
    return {
        "data": [
            {
                "id": str(r.id),
                "anomaly_id": str(r.anomaly_id),
                "station": station_name,
                "measurement": a.measurement,
                "previous_classification": r.previous_classification,
                "operator_classification": r.operator_classification,
                "comment": r.comment,
                "reviewer": email,
                "created_at": r.created_at.isoformat(),
            }
            for r, a, station_name, email in rows
        ],
        "meta": {"limit": pagination.limit, "offset": pagination.offset, "total": total},
    }
