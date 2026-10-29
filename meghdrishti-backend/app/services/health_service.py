"""Computes and persists a station's health score from its recent history."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.health.station_health import HealthInputs, boundaries_from_dict, compute_health
from app.models.anomalies import Anomaly
from app.models.observations import WeatherObservation
from app.models.qc import QCRuleResult
from app.models.reviews import OperatorReview
from app.repositories.calibration_repository import CalibrationRepository
from app.repositories.health_repository import HealthRepository
from app.services.event_publisher import publish_station_event

WINDOW_DAYS = 7
STUCK_DRIFT_RULES = ("STUCK_SENSOR", "GRADUAL_DRIFT")
TELEMETRY_RULES = ("DROPOUT", "TELEMETRY_GAP")
# Decisions that say something is wrong with the station. WATCH, INSUFFICIENT_CONTEXT and
# LIKELY_GENUINE_EXTREME describe the evidence or the weather, not the sensor.
FAULT_CLASSES = ("SUSPICIOUS", "PROBABLE_SENSOR_FAULT")
# Below this many readings in the window a score is noise (one bad reading would decide it).
MIN_OBSERVATIONS = 8
MEASUREMENTS = ("temperature_c", "humidity_pct", "pressure_hpa", "rainfall_mm", "wind_speed_ms", "wind_direction_deg")


class HealthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = HealthRepository(session)

    async def recompute(self, station_id: uuid.UUID) -> dict:
        since = datetime.now(UTC) - timedelta(days=WINDOW_DAYS)

        observations = (
            await self.session.execute(
                select(WeatherObservation.id, *(getattr(WeatherObservation, m) for m in MEASUREMENTS))
                .where(WeatherObservation.station_id == station_id, WeatherObservation.timestamp >= since)
            )
        ).all()
        obs_count = len(observations)
        obs_ids = [row[0] for row in observations]

        async def observations_with(rules: tuple[str, ...]) -> int:
            # Rules fire per measurement; count readings, so one reading with four blank
            # fields is one telemetry problem, not four.
            if not obs_ids:
                return 0
            return (
                await self.session.execute(
                    select(func.count(func.distinct(QCRuleResult.observation_id))).where(
                        QCRuleResult.observation_id.in_(obs_ids),
                        QCRuleResult.rule.in_(rules),
                        QCRuleResult.triggered.is_(True),
                    )
                )
            ).scalar_one()

        stuck_drift_triggers = await observations_with(STUCK_DRIFT_RULES)
        telemetry_triggers = await observations_with(TELEMETRY_RULES)

        anomaly_count = (
            await self.session.execute(
                select(func.count(func.distinct(Anomaly.observation_id))).where(
                    Anomaly.station_id == station_id,
                    Anomaly.created_at >= since,
                    Anomaly.classification.in_(FAULT_CLASSES),
                )
            )
        ).scalar_one()

        # Completeness against the sensors this station actually reports. A feed that never
        # carries a measurement (IMD rainfall, an AWS without a barometer) is not missing data.
        reported = [i for i in range(len(MEASUREMENTS)) if any(row[i + 1] is not None for row in observations)]
        avg_completeness = (
            100.0 * sum(sum(row[i + 1] is not None for i in reported) for row in observations) / (len(reported) * obs_count)
            if reported and obs_count
            else None
        )

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
        if obs_count < MIN_OBSERVATIONS:
            issues.append(f"Only {obs_count} readings in {WINDOW_DAYS} days; health is scored from {MIN_OBSERVATIONS}")
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
        if obs_count < MIN_OBSERVATIONS:
            result["status"] = "NEW"

        await self.repo.upsert(
            station_id, result["health_score"], result["status"], result["issues"], result["components"]
        )
        await publish_station_event(str(station_id), "STATION_HEALTH_UPDATED", result)
        return result
