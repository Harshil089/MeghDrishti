"""CROSS_VARIABLE_CONSISTENCY, RAIN_ACCUMULATION, TIMESTAMP_ANOMALY rules."""
from __future__ import annotations

from datetime import UTC, datetime

from app.schemas.qc import RuleResult


def evaluate_cross_variable(measurements: dict, thresholds: dict) -> RuleResult:
    """Rainfall reported while humidity is implausibly low is physically inconsistent."""
    cfg = thresholds.get("CROSS_VARIABLE_CONSISTENCY", {})
    rainfall = measurements.get("rainfall_mm")
    humidity = measurements.get("humidity_pct")
    min_humidity = cfg.get("rainfall_humidity_min_pct", 40.0)

    if rainfall is None or humidity is None or rainfall <= 0:
        return RuleResult(rule="CROSS_VARIABLE_CONSISTENCY", triggered=False, score=0.0, severity="LOW")

    if humidity >= min_humidity:
        return RuleResult(rule="CROSS_VARIABLE_CONSISTENCY", triggered=False, score=0.0, severity="LOW")

    score = min(1.0, 0.5 + (min_humidity - humidity) / min_humidity)
    return RuleResult(
        rule="CROSS_VARIABLE_CONSISTENCY",
        triggered=True,
        score=round(score, 3),
        severity="MEDIUM" if score < 0.7 else "HIGH",
        reason_code="RAIN_HUMIDITY_INCONSISTENT",
        evidence={"rainfall_mm": rainfall, "humidity_pct": humidity, "min_expected_humidity_pct": min_humidity},
    )


def evaluate_rain_accumulation(rainfall_mm: float | None, thresholds: dict) -> RuleResult:
    cfg = thresholds.get("RAIN_ACCUMULATION", {})
    extreme = cfg.get("extreme_mm_per_interval", 100.0)
    if rainfall_mm is None or rainfall_mm < extreme:
        return RuleResult(rule="RAIN_ACCUMULATION", triggered=False, score=0.0, severity="LOW")

    score = min(1.0, 0.6 + (rainfall_mm - extreme) / extreme)
    return RuleResult(
        rule="RAIN_ACCUMULATION",
        triggered=True,
        score=round(score, 3),
        severity="HIGH" if score < 0.85 else "CRITICAL",
        reason_code="RAINFALL_EXTREME",
        evidence={"rainfall_mm": rainfall_mm, "extreme_threshold_mm": extreme},
    )


def evaluate_timestamp_anomaly(observation_timestamp: datetime, received_at: datetime, thresholds: dict) -> RuleResult:
    cfg = thresholds.get("TIMESTAMP_ANOMALY", {})
    max_future_skew = cfg.get("max_future_skew_minutes", 5)

    ts = observation_timestamp if observation_timestamp.tzinfo else observation_timestamp.replace(tzinfo=UTC)
    ra = received_at if received_at.tzinfo else received_at.replace(tzinfo=UTC)
    skew_minutes = (ts - ra).total_seconds() / 60.0

    if skew_minutes <= max_future_skew:
        return RuleResult(rule="TIMESTAMP_ANOMALY", triggered=False, score=0.0, severity="LOW")

    score = min(1.0, 0.5 + skew_minutes / (max_future_skew * 10))
    return RuleResult(
        rule="TIMESTAMP_ANOMALY",
        triggered=True,
        score=round(score, 3),
        severity="MEDIUM" if score < 0.7 else "HIGH",
        reason_code="TIMESTAMP_ANOMALY",
        evidence={"skew_minutes": round(skew_minutes, 1), "max_future_skew_minutes": max_future_skew},
    )
