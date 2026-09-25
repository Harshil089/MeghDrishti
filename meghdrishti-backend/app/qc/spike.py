"""SPIKE (z-score outlier) and RATE_OF_CHANGE rules."""
from __future__ import annotations

import statistics
from datetime import datetime

from app.schemas.qc import RuleResult

REASON_CODES = {
    "temperature_c": "TEMP_SPIKE",
    "humidity_pct": "HUMIDITY_SPIKE",
    "pressure_hpa": "PRESSURE_SPIKE",
    "rainfall_mm": "RAINFALL_SPIKE",
    "wind_speed_ms": "WIND_SPIKE",
}


def evaluate_spike(measurement: str, value: float, history: list[float], thresholds: dict) -> RuleResult:
    cfg = thresholds.get("SPIKE", {})
    min_history = cfg.get("min_history", 8)
    if value is None or len(history) < min_history:
        return RuleResult(rule="SPIKE", triggered=False, score=0.0, severity="LOW")

    mean = statistics.fmean(history)
    stdev = statistics.pstdev(history) or 1e-6
    z = abs(value - mean) / stdev
    threshold = cfg.get("z_score_threshold", 4.0)

    if z < threshold:
        return RuleResult(rule="SPIKE", triggered=False, score=0.0, severity="LOW", evidence={"z_score": round(z, 2)})

    score = min(1.0, 0.5 + (z - threshold) / threshold)
    return RuleResult(
        rule="SPIKE",
        triggered=True,
        score=round(score, 3),
        severity="HIGH" if score < 0.85 else "CRITICAL",
        reason_code=REASON_CODES.get(measurement, "MEASUREMENT_SPIKE"),
        evidence={"measurement": measurement, "value": value, "mean": round(mean, 2), "z_score": round(z, 2)},
    )


def evaluate_rate_of_change(
    measurement: str,
    value: float,
    timestamp: datetime,
    prev_value: float | None,
    prev_timestamp: datetime | None,
    thresholds: dict,
) -> RuleResult:
    cfg = thresholds.get("RATE_OF_CHANGE", {}).get(measurement)
    if cfg is None or value is None or prev_value is None or prev_timestamp is None:
        return RuleResult(rule="RATE_OF_CHANGE", triggered=False, score=0.0, severity="LOW")

    minutes = max((timestamp - prev_timestamp).total_seconds() / 60.0, 1e-6)
    rate_per_5min = abs(value - prev_value) / minutes * 5.0
    max_rate = cfg["max_per_5min"]

    if rate_per_5min <= max_rate:
        return RuleResult(rule="RATE_OF_CHANGE", triggered=False, score=0.0, severity="LOW")

    score = min(1.0, 0.5 + (rate_per_5min - max_rate) / max_rate)
    return RuleResult(
        rule="RATE_OF_CHANGE",
        triggered=True,
        score=round(score, 3),
        severity="HIGH" if score < 0.85 else "CRITICAL",
        reason_code="RATE_OF_CHANGE_EXCEEDED",
        evidence={
            "measurement": measurement,
            "delta": round(value - prev_value, 2),
            "minutes": round(minutes, 1),
            "rate_per_5min": round(rate_per_5min, 2),
            "max_per_5min": max_rate,
        },
    )
