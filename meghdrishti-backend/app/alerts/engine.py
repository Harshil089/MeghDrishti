"""Turns a policy decision into a deduplicated, persisted Alert."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.policies import AlertDecision, AnomalySummary, evaluate_policies
from app.core.metrics import alerts_created_total
from app.models.alerts import Alert
from app.repositories.alert_repository import AlertRepository


def build_dedup_key(station_id: uuid.UUID, policy: str, anomaly_created_at) -> str:
    # 15-minute bucket: repeated triggers of the same policy within a short
    # window collapse into one alert instead of spamming operators.
    bucket = anomaly_created_at.replace(minute=(anomaly_created_at.minute // 15) * 15, second=0, microsecond=0)
    return f"{station_id}:{policy}:{bucket.isoformat()}"


class AlertEngine:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = AlertRepository(session)

    async def process_anomaly(
        self,
        station_id: uuid.UUID,
        anomaly_id: uuid.UUID,
        current: AnomalySummary,
        recent: list[AnomalySummary],
        evidence: dict,
    ) -> Alert | None:
        decision: AlertDecision = evaluate_policies(current, recent)
        if not decision.should_alert:
            return None

        dedup_key = build_dedup_key(station_id, decision.policy, current.created_at)
        existing = await self.repo.get_by_dedup_key(dedup_key)
        if existing is not None:
            return existing  # idempotent: duplicate source data must not create duplicate alerts

        alert = await self.repo.create(
            station_id=station_id,
            anomaly_id=anomaly_id,
            priority=decision.priority,
            policy=decision.policy,
            dedup_key=dedup_key,
            title=decision.title,
            details={"classification": current.classification, "severity": current.severity, **evidence},
        )
        alerts_created_total.labels(priority=decision.priority, policy=decision.policy).inc()
        return alert
