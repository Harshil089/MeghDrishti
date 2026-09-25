"""PERSISTENCE and STUCK_SENSOR rules: consecutive near-identical readings."""
from __future__ import annotations

from app.schemas.qc import RuleResult

REASON_CODES = {
    "temperature_c": "TEMP_STUCK",
    "humidity_pct": "HUMIDITY_STUCK",
    "pressure_hpa": "PRESSURE_STUCK",
}


def _consecutive_identical(value: float, history: list[float], tolerance: float) -> int:
    count = 1
    for v in history:  # history ordered most-recent-first
        if v is None or abs(v - value) > tolerance:
            break
        count += 1
    return count


def evaluate_persistence(measurement: str, value: float, history: list[float], thresholds: dict) -> RuleResult:
    cfg = thresholds.get("PERSISTENCE", {})
    if value is None:
        return RuleResult(rule="PERSISTENCE", triggered=False, score=0.0, severity="LOW")

    count = _consecutive_identical(value, history, tolerance=1e-9)
    min_consecutive = cfg.get("min_consecutive", 6)
    if count < min_consecutive:
        return RuleResult(rule="PERSISTENCE", triggered=False, score=0.0, severity="LOW", evidence={"consecutive_identical_count": count})

    score = min(1.0, 0.4 + 0.05 * (count - min_consecutive))
    return RuleResult(
        rule="PERSISTENCE",
        triggered=True,
        score=round(score, 3),
        severity="MEDIUM" if score < 0.65 else "HIGH",
        reason_code="VALUE_PERSISTED",
        evidence={"measurement": measurement, "consecutive_identical_count": count},
    )


def evaluate_stuck_sensor(measurement: str, value: float, history: list[float], thresholds: dict) -> RuleResult:
    cfg = thresholds.get("STUCK_SENSOR", {})
    if value is None:
        return RuleResult(rule="STUCK_SENSOR", triggered=False, score=0.0, severity="LOW")

    tolerance = cfg.get("tolerance", 0.01)
    count = _consecutive_identical(value, history, tolerance)
    min_consecutive = cfg.get("min_consecutive", 12)
    if count < min_consecutive:
        return RuleResult(rule="STUCK_SENSOR", triggered=False, score=0.0, severity="LOW", evidence={"consecutive_identical_count": count})

    score = min(1.0, 0.7 + 0.02 * (count - min_consecutive))
    return RuleResult(
        rule="STUCK_SENSOR",
        triggered=True,
        score=round(score, 3),
        severity="HIGH" if score < 0.9 else "CRITICAL",
        reason_code=REASON_CODES.get(measurement, "SENSOR_STUCK"),
        evidence={
            "measurement": measurement,
            "value": value,
            "consecutive_identical_count": count,
            "reason_code_detail": f"{measurement.upper()}_IDENTICAL_{count}_READINGS",
        },
    )
