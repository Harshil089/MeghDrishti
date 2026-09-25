"""Async implementations of the realtime processing pipeline.

Celery tasks (sync) call into these via asyncio.run(); kept separate so the
pipeline logic is directly unit/integration-testable without Celery.
"""
from __future__ import annotations

import uuid

from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.engine import AlertEngine
from app.alerts.policies import AnomalySummary
from app.context.engine import ContextEngine, ContextInputs
from app.context.era5 import fetch_era5_value
from app.context.forecast import fetch_forecast_value
from app.context.gpm import fetch_gpm_rainfall
from app.core.logging import get_logger
from app.core.metrics import anomalies_created_total, classification_counts, rules_triggered_total
from app.db.session import AsyncSessionLocal
from app.features.builder import MEASUREMENTS, FeatureBuilder, FeatureInputs
from app.ml.inference import run_inference
from app.ml.registry import ModelRegistry
from app.models.observations import ObservationFeatures, WeatherObservation
from app.qc.engine import QCContext, QCEngine
from app.repositories.anomaly_repository import AnomalyRepository
from app.repositories.context_repository import ContextRepository
from app.repositories.feature_repository import FeatureRepository
from app.repositories.observation_repository import ObservationRepository
from app.repositories.qc_repository import QCRepository
from app.repositories.station_repository import StationRepository
from app.scoring.decision import DecisionEngine
from app.services.event_publisher import publish_dashboard_event, publish_station_event
from app.services.health_service import HealthService

logger = get_logger("meghdrishti.workers.pipeline")


def _measurements_dict(obs: WeatherObservation) -> dict[str, float | None]:
    return {m: getattr(obs, m) for m in MEASUREMENTS}


async def run_rule_engine(session: AsyncSession, observation_id: uuid.UUID) -> list:
    obs_repo = ObservationRepository(session)
    result = await session.execute(select(WeatherObservation).where(WeatherObservation.id == observation_id))
    obs = result.scalar_one()

    history_rows = await obs_repo.recent_for_station(obs.station_id, before=obs.timestamp, limit=100)
    history_rows = [h for h in history_rows if h.id != obs.id]
    history = [{"timestamp": h.timestamp, **_measurements_dict(h)} for h in history_rows]

    ctx = QCContext(
        timestamp=obs.timestamp,
        received_at=obs.received_at,
        measurements=_measurements_dict(obs),
        history=history,
        last_observation_timestamp=history[0]["timestamp"] if history else None,
    )
    results = QCEngine().run(ctx)
    for r in results:
        if r.triggered:
            rules_triggered_total.labels(rule=r.rule).inc()
    await QCRepository(session).bulk_create(observation_id, results)
    return results


async def calculate_features(session: AsyncSession, observation_id: uuid.UUID) -> tuple[dict, float]:
    obs_repo = ObservationRepository(session)
    result = await session.execute(select(WeatherObservation).where(WeatherObservation.id == observation_id))
    obs = result.scalar_one()

    history_rows = await obs_repo.recent_for_station(obs.station_id, before=obs.timestamp, limit=100)
    history_rows = [h for h in history_rows if h.id != obs.id]
    history = [{"timestamp": h.timestamp, **_measurements_dict(h)} for h in history_rows]

    same_hour_history: dict[str, list[float]] = {m: [] for m in MEASUREMENTS}
    same_hour_rows = await session.execute(
        select(WeatherObservation).where(
            WeatherObservation.station_id == obs.station_id,
            extract("hour", WeatherObservation.timestamp) == obs.timestamp.hour,
            WeatherObservation.id != obs.id,
        ).limit(200)
    )
    for row in same_hour_rows.scalars().all():
        for m in MEASUREMENTS:
            v = getattr(row, m)
            if v is not None:
                same_hour_history[m].append(v)

    neighbors = await StationRepository(session).neighbors_of(obs.station_id)
    neighbor_values: dict[str, list[float]] = {m: [] for m in MEASUREMENTS}
    for n in neighbors[:5]:
        neighbor_latest = await obs_repo.recent_for_station(n.neighbor_station_id, before=obs.timestamp, limit=1)
        if neighbor_latest:
            for m in MEASUREMENTS:
                v = getattr(neighbor_latest[0], m)
                if v is not None:
                    neighbor_values[m].append(v)

    inputs = FeatureInputs(
        timestamp=obs.timestamp,
        measurements=_measurements_dict(obs),
        history=history,
        same_hour_history=same_hour_history,
        neighbor_values=neighbor_values,
    )
    features, completeness = FeatureBuilder().build(inputs)
    await FeatureRepository(session).upsert(observation_id, obs.station_id, features, completeness)
    return features, completeness


async def run_ml_inference(session: AsyncSession, observation_id: uuid.UUID, station_region: str | None) -> dict:
    result = await session.execute(
        select(ObservationFeatures).where(ObservationFeatures.observation_id == observation_id)
    )
    feature_row = result.scalar_one_or_none()
    if feature_row is None:
        return {}

    registry = ModelRegistry(session)
    ml_results: dict[str, object] = {}
    for measurement, feats in feature_row.features.items():
        model = await registry.get_active(measurement, station_region, None)
        if model is None:
            continue
        inference = run_inference(model, feats)
        if inference is None:
            continue
        ml_results[measurement] = inference

        from app.models.qc import MLResult

        session.add(
            MLResult(
                observation_id=observation_id,
                model_version_id=model.id,
                raw_score=inference.raw_score,
                normalized_anomaly_score=inference.normalized_anomaly_score,
                threshold=inference.threshold,
                is_anomalous=inference.is_anomalous,
                features_used=inference.features_used,
            )
        )
    await session.commit()
    return ml_results


async def run_context_validation(session: AsyncSession, observation_id: uuid.UUID) -> dict:
    result = await session.execute(select(WeatherObservation).where(WeatherObservation.id == observation_id))
    obs = result.scalar_one()
    station = await StationRepository(session).get(obs.station_id)

    feature_row = (
        await session.execute(select(ObservationFeatures).where(ObservationFeatures.observation_id == observation_id))
    ).scalar_one_or_none()

    engine = ContextEngine()
    ctx_repo = ContextRepository(session)
    context_results: dict[str, object] = {}

    for measurement in MEASUREMENTS:
        observed_value = getattr(obs, measurement)
        if observed_value is None:
            continue

        neighbor_median = None
        if feature_row:
            neighbor_median = feature_row.features.get(measurement, {}).get("neighbor_median")

        forecast_value = await fetch_forecast_value(station, measurement, obs.timestamp)
        era5_value = await fetch_era5_value(station, measurement, obs.timestamp)
        gpm_value = await fetch_gpm_rainfall(station, obs.timestamp) if measurement == "rainfall_mm" else None

        data = engine.evaluate(
            ContextInputs(
                measurement=measurement,
                observed_value=observed_value,
                neighbor_median=neighbor_median,
                forecast_value=forecast_value,
                era5_value=era5_value,
                gpm_value=gpm_value,
            )
        )
        await ctx_repo.create(observation_id, data)
        context_results[measurement] = data

    return context_results


async def calculate_final_decision(
    session: AsyncSession,
    observation_id: uuid.UUID,
    rule_results: list,
    ml_results: dict,
    context_results: dict,
) -> uuid.UUID | None:
    result = await session.execute(select(WeatherObservation).where(WeatherObservation.id == observation_id))
    obs = result.scalar_one()

    # Pick the measurement with the strongest rule signal to drive the decision.
    triggered_by_measurement: dict[str, float] = {}
    for r in rule_results:
        if r.triggered:
            m = r.evidence.get("measurement")
            if m:
                triggered_by_measurement[m] = max(triggered_by_measurement.get(m, 0.0), r.score)

    if triggered_by_measurement:
        measurement = max(triggered_by_measurement, key=triggered_by_measurement.get)
    else:
        measurement = next((m for m in MEASUREMENTS if getattr(obs, m) is not None), None)

    if measurement is None:
        return None

    measurement_rule_results = [r for r in rule_results if r.evidence.get("measurement") in (measurement, None)]
    ml_result = ml_results.get(measurement)
    context_result = context_results.get(measurement)

    feature_row = (
        await session.execute(select(ObservationFeatures).where(ObservationFeatures.observation_id == observation_id))
    ).scalar_one_or_none()
    completeness = feature_row.completeness_pct if feature_row else 100.0

    decision = DecisionEngine().decide(
        measurement_rule_results,
        ml_result,
        context_result,
        station_data_completeness_pct=completeness or 100.0,
    )

    anomaly_repo = AnomalyRepository(session)
    anomaly = await anomaly_repo.create(
        observation_id=observation_id,
        station_id=obs.station_id,
        classification=decision.classification,
        severity=decision.severity,
        fault_score=decision.fault_score,
        confidence=decision.confidence,
        reason_codes=decision.reason_codes,
        measurement=measurement,
        evidence={
            "RULE": [r.model_dump() for r in measurement_rule_results if r.triggered],
            "ML": ml_result.__dict__ if ml_result else {},
            "CONTEXT": context_result.__dict__ if context_result else {},
        },
    )

    anomalies_created_total.labels(classification=anomaly.classification).inc()
    classification_counts.labels(classification=anomaly.classification).inc()

    await create_alert_if_required(session, anomaly)
    await HealthService(session).recompute(obs.station_id)
    await publish_dashboard_event("ANOMALY_CREATED", {"anomaly_id": str(anomaly.id), "classification": anomaly.classification})
    await publish_station_event(
        str(obs.station_id), "ANOMALY_CREATED", {"anomaly_id": str(anomaly.id), "classification": anomaly.classification}
    )
    return anomaly.id


async def create_alert_if_required(session: AsyncSession, anomaly) -> None:
    anomaly_repo = AnomalyRepository(session)
    recent = await anomaly_repo.recent_for_station(anomaly.station_id, limit=20)
    recent_summaries = [AnomalySummary(a.classification, a.severity, a.created_at) for a in recent]
    current_summary = AnomalySummary(anomaly.classification, anomaly.severity, anomaly.created_at)

    alert = await AlertEngine(session).process_anomaly(
        anomaly.station_id,
        anomaly.id,
        current_summary,
        recent_summaries,
        {
            "reason_codes": anomaly.reason_codes,
            "confidence": anomaly.confidence,
            "fault_score": anomaly.fault_score,
            "measurement": anomaly.measurement,
        },
    )
    if alert is not None:
        await publish_dashboard_event("ALERT_CREATED", {"alert_id": str(alert.id), "priority": alert.priority})


async def process_observation(observation_id: uuid.UUID) -> uuid.UUID | None:
    """Full pipeline for one observation, run inside a single worker task chain."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(WeatherObservation).where(WeatherObservation.id == observation_id))
        obs = result.scalar_one_or_none()
        if obs is None:
            logger.warning("process_observation_missing", observation_id=str(observation_id))
            return None

        station = await StationRepository(session).get(obs.station_id)

        rule_results = await run_rule_engine(session, observation_id)
        await calculate_features(session, observation_id)
        ml_results = await run_ml_inference(session, observation_id, station.region if station else None)
        context_results = await run_context_validation(session, observation_id)
        anomaly_id = await calculate_final_decision(session, observation_id, rule_results, ml_results, context_results)
        return anomaly_id
