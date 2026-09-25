"""Computes and persists a station's health score from its recent history."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.health.station_health import HealthInputs, boundaries_from_dict, compute_health
from app.models.anomalies import Anomaly
from app.models.observations import ObservationFeatures, WeatherObservation
from app.models.qc import QCRuleResult
from app.models.reviews import OperatorReview
from app.repositories.calibration_repository import CalibrationRepository
from app.repositories.health_repository import HealthRepository
from app.services.event_publisher import publish_station_event

WINDOW_DAYS = 7
STUCK_DRIFT_RULES = ("STUCK_SENSOR", "GRADUAL_DRIFT")
TELEMETRY_RULES = ("DROPOUT", "TELEMETRY_GAP")


class HealthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = HealthRepository(session)

    async def recompute(self, station_id: uuid.UUID) -> dict:
        since = datetime.now(UTC) - timedelta(days=WINDOW_DAYS)

        obs_count = (
            await self.session.execute(
                select(func.count())
                .select_from(WeatherObservation)
                .where(WeatherObservation.station_id == station_id, WeatherObservation.timestamp >= since)
            )
        ).scalar_one()

        obs_ids_subq = (
            select(WeatherObservation.id)
            .where(WeatherObservation.station_id == station_id, WeatherObservation.timestamp >= since)
            .subquery()
        )

        stuck_drift_triggers = (
            await self.session.execute(
                select(func.count())
                .select_from(QCRuleResult)
                .where(
                    QCRuleResult.observation_id.in_(select(obs_ids_subq.c.id)),
                    QCRuleResult.rule.in_(STUCK_DRIFT_RULES),
                    QCRuleResult.triggered.is_(True),
                )
            )
        ).scalar_one()

        telemetry_triggers = (
            await self.session.execute(
                select(func.count())
                .select_from(QCRuleResult)
                .where(
                    QCRuleResult.observation_id.in_(select(obs_ids_subq.c.id)),
                    QCRuleResult.rule.in_(TELEMETRY_RULES),
                    QCRuleResult.triggered.is_(True),
                )
            )
        ).scalar_one()

        anomaly_count = (
            await self.session.execute(
                select(func.count())
                .select_from(Anomaly)
                .where(
                    Anomaly.station_id == station_id,
                    Anomaly.created_at >= since,
                    Anomaly.classification != "NORMAL",
                )
            )
        ).scalar_one()

        avg_completeness = (
            await self.session.execute(
                select(func.avg(ObservationFeatures.completeness_pct)).where(
                    ObservationFeatures.station_id == station_id
                )
            )
        ).scalar_one()

        confirmed_faults = (
            await self.session.execute(
                select(func.count())
                .select_from(OperatorReview)
                .join(Anomaly, Anomaly.id == OperatorReview.anomaly_id)
                .where(
                    Anomaly.station_id == station_id,
                    OperatorReview.operator_classification == "CONFIRMED_SENSOR_FAULT",
                    OperatorReview.created_at >= datetime.now(UTC) - timedelta(days=30),
                )
            )
        ).scalar_one()

        denom = max(obs_count, 1)
        sensor_reliability_pct = max(0.0, 100.0 - 100.0 * stuck_drift_triggers / denom)
        telemetry_reliability_pct = max(0.0, 100.0 - 100.0 * telemetry_triggers / denom)
        anomaly_rate_pct = min(100.0, 100.0 * anomaly_count / denom)

        issues = []
        if telemetry_triggers > 0:
            issues.append(f"{telemetry_triggers} telemetry dropouts/gaps in {WINDOW_DAYS} days")
        if stuck_drift_triggers > 0:
            issues.append(f"{stuck_drift_triggers} stuck/drift signals in {WINDOW_DAYS} days")
        if confirmed_faults > 0:
            issues.append(f"{confirmed_faults} confirmed sensor faults in 30 days")

        profile = await CalibrationRepository(self.session).get_active()
        health_weights = profile.health_weights if profile and profile.health_weights else None
        health_boundaries = boundaries_from_dict(profile.health_boundaries) if profile else None

        result = compute_health(
            HealthInputs(
                sensor_reliability_pct=round(sensor_reliability_pct, 2),
                telemetry_reliability_pct=round(telemetry_reliability_pct, 2),
                anomaly_rate_pct=round(anomaly_rate_pct, 2),
                completeness_pct=round(float(avg_completeness), 2) if avg_completeness is not None else 100.0,
                confirmed_fault_count_30d=confirmed_faults,
                issues=issues,
            ),
            weights=health_weights,
            boundaries=health_boundaries,
        )

        await self.repo.upsert(
            station_id, result["health_score"], result["status"], result["issues"], result["components"]
        )
        await publish_station_event(str(station_id), "STATION_HEALTH_UPDATED", result)
        return result
