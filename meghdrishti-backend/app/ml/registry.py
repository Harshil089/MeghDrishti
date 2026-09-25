"""Model version registry: persist candidates, evaluate, and explicitly activate."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path

import joblib
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.ml.training import TrainedModel
from app.models.ml import ModelVersion

logger = get_logger("meghdrishti.ml.registry")

MODEL_STORE = Path(__file__).resolve().parent.parent.parent / "model_store"


class ModelRegistry:
    def __init__(self, session: AsyncSession):
        self.session = session

    def _artifact_path(self, model_id: str, version: str) -> Path:
        MODEL_STORE.mkdir(parents=True, exist_ok=True)
        return MODEL_STORE / f"{model_id}__{version}.joblib"

    async def register_candidate(
        self,
        measurement: str,
        trained: TrainedModel,
        region: str | None = None,
        season: str | None = None,
        training_start: datetime | None = None,
        training_end: datetime | None = None,
        metrics: dict | None = None,
    ) -> ModelVersion:
        model_id = f"iforest__{measurement}__{region or 'global'}__{season or 'all'}"
        version = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
        artifact_path = self._artifact_path(model_id, version)
        joblib.dump(trained.estimator, artifact_path)

        row = ModelVersion(
            model_id=model_id,
            model_version=version,
            measurement=measurement,
            region=region,
            season=season,
            feature_names=trained.feature_names,
            training_start=training_start,
            training_end=training_end,
            contamination=trained.contamination,
            threshold=trained.threshold,
            metrics=metrics or {},
            artifact_path=str(artifact_path),
            status="CANDIDATE",
        )
        self.session.add(row)
        await self.session.commit()
        await self.session.refresh(row)
        return row

    async def activate(self, model_version_id: uuid.UUID) -> ModelVersion:
        """Explicit activation only — never automatic just because training succeeded."""
        result = await self.session.execute(select(ModelVersion).where(ModelVersion.id == model_version_id))
        candidate = result.scalar_one()

        prev = await self.session.execute(
            select(ModelVersion).where(
                ModelVersion.model_id == candidate.model_id,
                ModelVersion.status == "ACTIVE",
            )
        )
        for row in prev.scalars().all():
            row.status = "RETIRED"

        candidate.status = "ACTIVE"
        await self.session.commit()
        await self.session.refresh(candidate)
        return candidate

    async def mark_failed(self, model_version_id: uuid.UUID) -> None:
        result = await self.session.execute(select(ModelVersion).where(ModelVersion.id == model_version_id))
        row = result.scalar_one()
        row.status = "FAILED"
        await self.session.commit()

    async def get_active(
        self, measurement: str, region: str | None, season: str | None
    ) -> ModelVersion | None:
        """Region+season match preferred; falls back to a global model."""
        for candidate_region, candidate_season in [(region, season), (region, None), (None, None)]:
            stmt = select(ModelVersion).where(
                ModelVersion.measurement == measurement,
                ModelVersion.status == "ACTIVE",
                ModelVersion.region.is_(candidate_region) if candidate_region is None else ModelVersion.region == candidate_region,
                ModelVersion.season.is_(candidate_season) if candidate_season is None else ModelVersion.season == candidate_season,
            )
            result = await self.session.execute(stmt.order_by(ModelVersion.created_at.desc()).limit(1))
            row = result.scalar_one_or_none()
            if row is not None:
                return row
        return None
