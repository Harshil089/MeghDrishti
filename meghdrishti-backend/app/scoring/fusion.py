"""Evidence fusion: combines rule/ML/neighbor/context/telemetry signals into one fault score."""
from __future__ import annotations

from dataclasses import dataclass

from app.scoring.defaults import DEFAULT_FUSION_WEIGHTS


@dataclass
class FusionInputs:
    rule_score: float = 0.0
    ml_score: float = 0.0
    neighbor_mismatch: float = 0.0
    context_mismatch: float = 0.0
    telemetry_score: float = 0.0


def compute_fault_score(inputs: FusionInputs, weights: dict | None = None) -> float:
    w = {**DEFAULT_FUSION_WEIGHTS, **(weights or {})}
    score = (
        w["rule"] * inputs.rule_score
        + w["ml"] * inputs.ml_score
        + w["neighbor_mismatch"] * inputs.neighbor_mismatch
        + w["context_mismatch"] * inputs.context_mismatch
        + w["telemetry"] * inputs.telemetry_score
    )
    return round(min(1.0, max(0.0, score)), 4)
