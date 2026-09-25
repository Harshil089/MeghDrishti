"""DROPOUT and TELEMETRY_GAP rules: missing measurement / missing interval."""
from __future__ import annotations

from datetime import datetime

from app.schemas.qc import RuleResult


def evaluate_dropout(measurement: str, value: float | None, thresholds: dict) -> RuleResult:
    if value is not None:
        return RuleResult(rule="DROPOUT", triggered=False, score=0.0, severity="LOW")
    return RuleResult(
        rule="DROPOUT",
        triggered=True,
        score=0.5,
        severity="MEDIUM",
        reason_code="DROPOUT",
        evidence={"measurement": measurement},
    )


def evaluate_telemetry_gap(
    timestamp: datetime, last_observation_timestamp: datetime | None, thresholds: dict
) -> RuleResult:
    cfg = thresholds.get("TELEMETRY_GAP", {})
    expected_minutes = cfg.get("expected_interval_minutes", 15)
    gap_factor = cfg.get("gap_factor", 4.0)

    if last_observation_timestamp is None:
        return RuleResult(rule="TELEMETRY_GAP", triggered=False, score=0.0, severity="LOW")

    gap_minutes = (timestamp - last_observation_timestamp).total_seconds() / 60.0
    if gap_minutes <= expected_minutes * gap_factor:
        return RuleResult(rule="TELEMETRY_GAP", triggered=False, score=0.0, severity="LOW", evidence={"gap_minutes": round(gap_minutes, 1)})

    score = min(1.0, 0.5 + gap_minutes / (expected_minutes * gap_factor) * 0.2)
    return RuleResult(
        rule="TELEMETRY_GAP",
        triggered=True,
        score=round(score, 3),
        severity="HIGH" if score < 0.85 else "CRITICAL",
        reason_code="TELEMETRY_GAP",
        evidence={"gap_minutes": round(gap_minutes, 1), "expected_interval_minutes": expected_minutes},
    )
