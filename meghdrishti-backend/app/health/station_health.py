"""Station-level health score, independent of any single anomaly decision."""
from __future__ import annotations

from dataclasses import dataclass, field

DEFAULT_WEIGHTS = {
    "sensor_reliability": 0.35,
    "telemetry_reliability": 0.25,
    "anomaly_frequency": 0.20,
    "completeness": 0.10,
    "confirmed_fault_history": 0.10,
}

DEFAULT_BOUNDARIES = [
    (90, "HEALTHY"),
    (70, "DEGRADED"),
    (40, "POOR"),
    (0, "CRITICAL"),
]


@dataclass
class HealthInputs:
    sensor_reliability_pct: float  # 100 - (stuck/drift rule trigger rate over window)
    telemetry_reliability_pct: float  # 100 - (dropout/gap rate over window)
    anomaly_rate_pct: float  # anomalies / observations over window, 0..100
    completeness_pct: float
    confirmed_fault_count_30d: int
    issues: list[str] = field(default_factory=list)


def status_for_score(score: float, boundaries: list[tuple[float, str]] | None = None) -> str:
    for threshold, label in boundaries or DEFAULT_BOUNDARIES:
        if score >= threshold:
            return label
    return "CRITICAL"


def compute_health(inputs: HealthInputs, weights: dict | None = None, boundaries: list[tuple[float, str]] | None = None) -> dict:
    w = {**DEFAULT_WEIGHTS, **(weights or {})}

    anomaly_frequency_score = max(0.0, 100.0 - inputs.anomaly_rate_pct)
    confirmed_fault_penalty = max(0.0, 100.0 - inputs.confirmed_fault_count_30d * 15.0)

    score = (
        w["sensor_reliability"] * inputs.sensor_reliability_pct
        + w["telemetry_reliability"] * inputs.telemetry_reliability_pct
        + w["anomaly_frequency"] * anomaly_frequency_score
        + w["completeness"] * inputs.completeness_pct
        + w["confirmed_fault_history"] * confirmed_fault_penalty
    )
    score = round(min(100.0, max(0.0, score)), 2)

    return {
        "health_score": score,
        "status": status_for_score(score, boundaries),
        "issues": inputs.issues,
        "components": {
            "sensor_reliability_pct": inputs.sensor_reliability_pct,
            "telemetry_reliability_pct": inputs.telemetry_reliability_pct,
            "anomaly_rate_pct": inputs.anomaly_rate_pct,
            "completeness_pct": inputs.completeness_pct,
            "confirmed_fault_count_30d": inputs.confirmed_fault_count_30d,
        },
    }
