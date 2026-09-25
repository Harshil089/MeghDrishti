"""Default rule thresholds — used when no calibration profile overrides them.

These live here, not as scattered magic constants inside each rule module.
A CalibrationProfile.rule_thresholds dict, loaded from the DB, is merged on
top of this at engine construction time.
"""
from __future__ import annotations

DEFAULT_RULE_THRESHOLDS: dict = {
    "PHYSICAL_RANGE": {
        "temperature_c": {"min": -40.0, "max": 55.0},
        "humidity_pct": {"min": 0.0, "max": 100.0},
        "pressure_hpa": {"min": 870.0, "max": 1085.0},
        "rainfall_mm": {"min": 0.0, "max": 300.0},  # per observation interval
        "wind_speed_ms": {"min": 0.0, "max": 120.0},
        "wind_direction_deg": {"min": 0.0, "max": 360.0},
    },
    "RATE_OF_CHANGE": {
        "temperature_c": {"max_per_5min": 5.0},
        "pressure_hpa": {"max_per_5min": 4.0},
        "humidity_pct": {"max_per_5min": 30.0},
        "wind_speed_ms": {"max_per_5min": 25.0},
    },
    "SPIKE": {
        "z_score_threshold": 4.0,
        "min_history": 8,
    },
    "PERSISTENCE": {
        "min_consecutive": 6,
    },
    "STUCK_SENSOR": {
        "min_consecutive": 12,
        "tolerance": 0.01,
    },
    "GRADUAL_DRIFT": {
        "window": 24,
        "min_history": 24,
        "slope_threshold_per_hour": {
            "temperature_c": 1.5,
            "pressure_hpa": 1.0,
            "humidity_pct": 5.0,
        },
    },
    "DROPOUT": {
        "expected_interval_minutes": 15,
        "missing_factor": 2.0,
    },
    "TELEMETRY_GAP": {
        "expected_interval_minutes": 15,
        "gap_factor": 4.0,
    },
    "CROSS_VARIABLE_CONSISTENCY": {
        "rainfall_humidity_min_pct": 40.0,
    },
    "RAIN_ACCUMULATION": {
        "extreme_mm_per_interval": 100.0,
    },
    "TIMESTAMP_ANOMALY": {
        "max_future_skew_minutes": 5,
    },
}

SEVERITY_BY_SCORE = [
    (0.85, "CRITICAL"),
    (0.65, "HIGH"),
    (0.4, "MEDIUM"),
    (0.0, "LOW"),
]


def severity_for(score: float) -> str:
    for threshold, label in SEVERITY_BY_SCORE:
        if score >= threshold:
            return label
    return "LOW"
