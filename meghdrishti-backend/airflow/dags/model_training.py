"""model_training DAG: extract_data -> generate_features -> train_candidate -> evaluate_candidate -> register_model.

Registration only ever produces a CANDIDATE model (app.ml.registry never
auto-activates); an operator/scientist reviews evaluate_candidate's metrics
and activates it separately through the admin/models API.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from airflow.decorators import dag, task

MEASUREMENTS = ["temperature_c", "humidity_pct", "pressure_hpa", "wind_speed_ms"]
FEATURE_NAMES = ["value", "delta_1h", "rolling_std", "neighbor_deviation"]


@dag(
    dag_id="model_training",
    schedule="0 3 * * 0",  # weekly, Sunday 03:00
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["ml"],
)
def model_training():
    @task
    def train_all_measurements() -> list[str]:
        from sqlalchemy import select

        from app.db.session import AsyncSessionLocal
        from app.ml.evaluation import evaluate_candidate
        from app.ml.registry import ModelRegistry
        from app.ml.training import train_isolation_forest
        from app.models.observations import ObservationFeatures

        async def _run() -> list[str]:
            candidate_ids: list[str] = []
            since = datetime.utcnow() - timedelta(days=90)
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(ObservationFeatures).where(ObservationFeatures.created_at >= since)
                )
                feature_rows = result.scalars().all()

                for measurement in MEASUREMENTS:
                    rows = [
                        fr.features.get(measurement, {})
                        for fr in feature_rows
                        if fr.features.get(measurement, {}).get("value") is not None
                    ]
                    if len(rows) < 50:
                        continue
                    try:
                        trained = train_isolation_forest(rows, FEATURE_NAMES)
                    except ValueError:
                        continue
                    metrics = evaluate_candidate(trained, rows)
                    registry = ModelRegistry(session)
                    model = await registry.register_candidate(
                        measurement, trained, training_start=since, training_end=datetime.utcnow(), metrics=metrics
                    )
                    candidate_ids.append(str(model.id))
            return candidate_ids

        return asyncio.run(_run())

    train_all_measurements()


model_training()
