"""Alert policies: an anomaly is not automatically an alert."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

CONSECUTIVE_SUSPICIOUS_THRESHOLD = 3
BURST_COUNT_THRESHOLD = 5
BURST_WINDOW_MINUTES = 30

CRITICAL_CLASSIFICATIONS = {"PROBABLE_SENSOR_FAULT"}
INFORMATIONAL_CLASSIFICATIONS = {"LIKELY_GENUINE_EXTREME"}


@dataclass
class AnomalySummary:
    classification: str
    severity: str
    created_at: datetime


@dataclass
class AlertDecision:
    should_alert: bool
    policy: str
    priority: str
    title: str


def evaluate_policies(
    current: AnomalySummary, recent: list[AnomalySummary]
) -> AlertDecision:
    """recent must be ordered most-recent-first and include `current`."""

    if current.classification == "PROBABLE_SENSOR_FAULT" and current.severity == "CRITICAL":
        return AlertDecision(True, "CRITICAL_PHYSICAL_IMPOSSIBILITY", "CRITICAL", "Critical sensor fault detected")

    if current.classification in INFORMATIONAL_CLASSIFICATIONS:
        return AlertDecision(True, "GENUINE_EXTREME_EVENT", "MEDIUM", "Genuine extreme weather event detected")

    now = current.created_at
    window_start = now - timedelta(minutes=BURST_WINDOW_MINUTES)
    burst = [a for a in recent if a.created_at >= window_start and a.classification != "NORMAL"]
    if len(burst) >= BURST_COUNT_THRESHOLD:
        max_severity = _max_severity([a.severity for a in burst])
        return AlertDecision(True, "ANOMALY_BURST", max_severity, f"{len(burst)} anomalies in {BURST_WINDOW_MINUTES} minutes")

    consecutive_suspicious = 0
    for a in recent:
        if a.classification in ("SUSPICIOUS", "PROBABLE_SENSOR_FAULT"):
            consecutive_suspicious += 1
        else:
            break
    if consecutive_suspicious >= CONSECUTIVE_SUSPICIOUS_THRESHOLD:
        return AlertDecision(True, "CONSECUTIVE_SUSPICIOUS", "MEDIUM", f"{consecutive_suspicious} consecutive suspicious readings")

    if current.classification == "PROBABLE_SENSOR_FAULT":
        return AlertDecision(True, "SINGLE_PROBABLE_FAULT", "HIGH", "Probable sensor fault detected")

    return AlertDecision(False, "NONE", "LOW", "")


_SEVERITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def _max_severity(severities: list[str]) -> str:
    best = "LOW"
    for s in severities:
        if _SEVERITY_ORDER.index(s) > _SEVERITY_ORDER.index(best):
            best = s
    return best
