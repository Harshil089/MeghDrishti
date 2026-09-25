from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Pagination, pagination_params
from app.core.exceptions import NotFoundError
from app.core.permissions import Permission, require_permission
from app.db.session import get_db
from app.ml.registry import ModelRegistry
from app.models.ml import ModelVersion

router = APIRouter()


def _out(m: ModelVersion) -> dict:
    return {
        "id": str(m.id),
        "model_id": m.model_id,
        "model_version": m.model_version,
        "measurement": m.measurement,
        "region": m.region,
        "season": m.season,
        "feature_names": m.feature_names,
        "contamination": m.contamination,
        "threshold": m.threshold,
        "metrics": m.metrics,
        "status": m.status,
        "created_at": m.created_at.isoformat(),
    }


@router.get("")
async def list_models(
    measurement: str | None = None,
    status: str | None = None,
    pagination: Pagination = Depends(pagination_params),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ModelVersion).order_by(ModelVersion.created_at.desc()).limit(pagination.limit).offset(pagination.offset)
    if measurement:
        stmt = stmt.where(ModelVersion.measurement == measurement)
    if status:
        stmt = stmt.where(ModelVersion.status == status)
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    return {"data": [_out(m) for m in rows], "meta": {"limit": pagination.limit, "offset": pagination.offset}}


@router.get("/{model_id}")
async def get_model(model_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelVersion).where(ModelVersion.id == model_id))
    model = result.scalar_one_or_none()
    if model is None:
        raise NotFoundError("Model version does not exist", code="MODEL_NOT_FOUND")
    return {"data": _out(model)}


@router.post("/{model_id}/activate")
async def activate_model(
    model_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_permission(Permission.MANAGE_MODELS)),
):
    registry = ModelRegistry(db)
    try:
        model = await registry.activate(model_id)
    except Exception as exc:  # noqa: BLE001 - unknown id from a bad UUID lookup
        raise NotFoundError("Model version does not exist", code="MODEL_NOT_FOUND") from exc
    return {"data": _out(model)}
