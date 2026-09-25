"""Confidence: distinct from fault score. A high fault score from one lone source is not high confidence."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ConfidenceInputs:
    evidence_source_count: int  # how many of {rule, ml, neighbor, context} actually produced a signal
    agreement: float  # 0..1, how much those sources agree with each other
    context_available: bool
    model_reliability: float = 0.5  # e.g. active model's historical precision
    station_data_completeness_pct: float = 100.0
    station_historical_quality: float = 0.5  # 0..1, derived from station health history


def compute_confidence(inputs: ConfidenceInputs) -> float:
    source_factor = min(1.0, inputs.evidence_source_count / 4.0)
    context_factor = 1.0 if inputs.context_available else 0.6
    completeness_factor = max(0.3, inputs.station_data_completeness_pct / 100.0)

    confidence = (
        0.35 * source_factor
        + 0.25 * inputs.agreement
        + 0.15 * context_factor
        + 0.15 * inputs.model_reliability
        + 0.10 * inputs.station_historical_quality
    ) * completeness_factor

    return round(min(1.0, max(0.0, confidence)), 4)
