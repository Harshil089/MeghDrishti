"""Severity derivation from fault score + classification."""
from __future__ import annotations

_SCORE_SEVERITY = [(0.85, "CRITICAL"), (0.65, "HIGH"), (0.4, "MEDIUM"), (0.0, "LOW")]


def severity_for_score(score: float) -> str:
    for threshold, label in _SCORE_SEVERITY:
        if score >= threshold:
            return label
    return "LOW"


def severity_for_classification(classification: str, fault_score: float) -> str:
    if classification == "LIKELY_GENUINE_EXTREME":
        return "CRITICAL" if fault_score >= 0.7 else "HIGH"
    if classification == "PROBABLE_SENSOR_FAULT":
        return severity_for_score(max(fault_score, 0.65))
    if classification == "INSUFFICIENT_CONTEXT":
        return "MEDIUM"
    return severity_for_score(fault_score)
