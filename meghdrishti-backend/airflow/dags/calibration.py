"""calibration DAG: aggregate_operator_labels -> calculate_metrics -> propose_thresholds -> save_candidate_profile.

Saves a new inactive CalibrationProfile row for review — it never flips
is_active itself, matching "operator feedback must not instantly retrain
production models/thresholds".
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from airflow.decorators import dag, task

from app.qc.defaults import DEFAULT_RULE_THRESHOLDS
from app.scoring.defaults import DEFAULT_DECISION_THRESHOLDS, DEFAULT_FUSION_WEIGHTS


@dag(
    dag_id="calibration",
    schedule="0 4 * * 1",  # weekly, Monday 04:00
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["ml", "calibration"],
)
def calibration():
    @task
    def aggregate_and_propose() -> dict:
        from sqlalchemy import func, select

        from app.db.session import AsyncSessionLocal
        from app.models.calibration import CalibrationProfile
        from app.models.reviews import OperatorReview

        async def _run() -> dict:
            since = datetime.utcnow() - timedelta(days=30)
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(OperatorReview.operator_classification, func.count())
                    .where(OperatorReview.created_at >= since)
                    .group_by(OperatorReview.operator_classification)
                )
                label_counts = {row[0]: row[1] for row in result.all()}

                total = sum(label_counts.values()) or 1
                false_positive_rate = label_counts.get("FALSE_POSITIVE", 0) / total

                # propose_thresholds: nudge WATCH/SUSPICIOUS up slightly if
                # false positives are running hot, down if reviewers rarely
                # dispute flagged anomalies. A human still reviews before
                # this profile is ever activated.
                thresholds = dict(DEFAULT_DECISION_THRESHOLDS)
                if false_positive_rate > 0.3:
                    thresholds["WATCH"] = min(0.5, thresholds["WATCH"] + 0.05)
                    thresholds["SUSPICIOUS"] = min(0.7, thresholds["SUSPICIOUS"] + 0.05)
                elif false_positive_rate < 0.05 and total >= 20:
                    thresholds["WATCH"] = max(0.15, thresholds["WATCH"] - 0.05)

                profile = CalibrationProfile(
                    name=f"auto-calibration-{datetime.utcnow().strftime('%Y%m%d')}",
                    is_active=False,
                    rule_thresholds=DEFAULT_RULE_THRESHOLDS,
                    fusion_weights=DEFAULT_FUSION_WEIGHTS,
                    decision_thresholds=thresholds,
                    health_weights={},
                    health_boundaries={},
                )
                session.add(profile)
                await session.commit()
                return {"profile_id": str(profile.id), "false_positive_rate": false_positive_rate, "label_counts": label_counts}

        return asyncio.run(_run())

    aggregate_and_propose()


calibration()
