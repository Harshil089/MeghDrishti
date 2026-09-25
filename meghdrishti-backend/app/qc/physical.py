"""PHYSICAL_RANGE rule: measurement must fall within physically plausible bounds."""
from __future__ import annotations

from app.schemas.qc import RuleResult

REASON_CODES = {
    "temperature_c": "TEMP_PHYSICAL_LIMIT",
    "humidity_pct": "HUMIDITY_PHYSICAL_LIMIT",
    "pressure_hpa": "PRESSURE_PHYSICAL_LIMIT",
    "rainfall_mm": "RAINFALL_PHYSICAL_LIMIT",
    "wind_speed_ms": "WIND_SPEED_PHYSICAL_LIMIT",
    "wind_direction_deg": "WIND_DIRECTION_PHYSICAL_LIMIT",
}


def evaluate(measurement: str, value: float, thresholds: dict) -> RuleResult:
    bounds = thresholds.get(measurement)
    if bounds is None or value is None:
        return RuleResult(
            rule="PHYSICAL_RANGE", triggered=False, score=0.0, severity="LOW", evidence={"measurement": measurement}
        )

    lo, hi = bounds["min"], bounds["max"]
    if lo <= value <= hi:
        return RuleResult(
            rule="PHYSICAL_RANGE",
            triggered=False,
            score=0.0,
            severity="LOW",
            evidence={"measurement": measurement, "value": value},
        )

    span = max(hi - lo, 1e-6)
    overshoot = max(lo - value, value - hi) / span
    score = min(1.0, 0.6 + overshoot)
    return RuleResult(
        rule="PHYSICAL_RANGE",
        triggered=True,
        score=round(score, 3),
        severity="CRITICAL",
        reason_code=REASON_CODES.get(measurement, "PHYSICAL_LIMIT"),
        evidence={"measurement": measurement, "value": value, "min": lo, "max": hi},
    )
