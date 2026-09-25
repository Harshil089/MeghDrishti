"""Default fusion weights and decision thresholds. Overridable via calibration_profiles."""
from __future__ import annotations

DEFAULT_FUSION_WEIGHTS: dict = {
    "rule": 0.35,
    "ml": 0.25,
    "neighbor_mismatch": 0.20,
    "context_mismatch": 0.15,
    "telemetry": 0.05,
}

DEFAULT_DECISION_THRESHOLDS: dict = {
    "NORMAL": 0.0,
    "WATCH": 0.30,
    "SUSPICIOUS": 0.55,
    "PROBABLE_SENSOR_FAULT": 0.75,
}

# ExtremeEventGuard thresholds
STRONG_CONTEXT_AGREEMENT = 0.75
STRONG_CONTEXT_DISAGREEMENT = 0.35
STRONG_ANOMALY_EVIDENCE = 0.65
