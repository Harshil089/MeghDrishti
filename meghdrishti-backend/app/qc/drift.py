"""GRADUAL_DRIFT rule: slow monotonic deviation from the historical baseline."""
from __future__ import annotations

from datetime import datetime

from app.schemas.qc import RuleResult

REASON_CODES = {
    "temperature_c": "TEMP_DRIFT",
    "pressure_hpa": "PRESSURE_DRIFT",
    "humidity_pct": "HUMIDITY_DRIFT",
}


def evaluate(
    measurement: str,
    value: float,
    timestamp: datetime,
    history: list[tuple[datetime, float]],
    thresholds: dict,
) -> RuleResult:
    cfg = thresholds.get("GRADUAL_DRIFT", {})
    min_history = cfg.get("min_history", 24)
    if value is None or len(history) < min_history:
        return RuleResult(
            rule="GRADUAL_DRIFT", triggered=False, score=0.0, severity="LOW", evidence={"measurement": measurement}
        )

    window = cfg.get("window", 24)
    points = sorted(history[:window] + [(timestamp, value)], key=lambda p: p[0])
    if len(points) < 3:
        return RuleResult(
            rule="GRADUAL_DRIFT", triggered=False, score=0.0, severity="LOW", evidence={"measurement": measurement}
        )

    t0 = points[0][0]
    xs = [(t - t0).total_seconds() / 3600.0 for t, _ in points]
    ys = [v for _, v in points]
    slope = _linear_slope(xs, ys)

    threshold_per_hour = cfg.get("slope_threshold_per_hour", {}).get(measurement)
    if threshold_per_hour is None or abs(slope) < threshold_per_hour:
        return RuleResult(rule="GRADUAL_DRIFT", triggered=False, score=0.0, severity="LOW", evidence={"slope_per_hour": round(slope, 4)})

    score = min(1.0, 0.5 + abs(slope) / threshold_per_hour * 0.3)
    return RuleResult(
        rule="GRADUAL_DRIFT",
        triggered=True,
        score=round(score, 3),
        severity="MEDIUM" if score < 0.7 else "HIGH",
        reason_code=REASON_CODES.get(measurement, "MEASUREMENT_DRIFT"),
        evidence={"measurement": measurement, "slope_per_hour": round(slope, 4), "threshold_per_hour": threshold_per_hour},
    )


def _linear_slope(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys, strict=True))
    den = sum((x - mean_x) ** 2 for x in xs) or 1e-9
    return num / den
