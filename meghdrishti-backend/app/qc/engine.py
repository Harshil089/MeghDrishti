"""Pluggable rule engine: runs every QC rule against an observation + its recent history."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.qc import cross_variable, drift, dropout, persistence, physical, spike
from app.qc.defaults import DEFAULT_RULE_THRESHOLDS
from app.schemas.qc import RuleResult

MEASUREMENTS = [
    "temperature_c",
    "humidity_pct",
    "pressure_hpa",
    "rainfall_mm",
    "wind_speed_ms",
    "wind_direction_deg",
]


@dataclass
class QCContext:
    timestamp: datetime
    received_at: datetime
    measurements: dict[str, float | None]
    history: list[dict]  # ordered most-recent-first: [{"timestamp": dt, <measurement>: value, ...}]
    last_observation_timestamp: datetime | None = None
    thresholds: dict = field(default_factory=lambda: DEFAULT_RULE_THRESHOLDS)


def merge_thresholds(overrides: dict | None) -> dict:
    merged = {k: (v.copy() if isinstance(v, dict) else v) for k, v in DEFAULT_RULE_THRESHOLDS.items()}
    if overrides:
        for rule, cfg in overrides.items():
            if isinstance(cfg, dict) and isinstance(merged.get(rule), dict):
                merged[rule].update(cfg)
            else:
                merged[rule] = cfg
    return merged


class QCEngine:
    def run(self, ctx: QCContext) -> list[RuleResult]:
        results: list[RuleResult] = []
        thresholds = ctx.thresholds

        prev_point = ctx.history[0] if ctx.history else None

        for measurement in MEASUREMENTS:
            value = ctx.measurements.get(measurement)
            history_values = [h.get(measurement) for h in ctx.history if h.get(measurement) is not None]

            results.append(physical.evaluate(measurement, value, thresholds.get("PHYSICAL_RANGE", {})))

            if prev_point is not None:
                results.append(
                    spike.evaluate_rate_of_change(
                        measurement,
                        value,
                        ctx.timestamp,
                        prev_point.get(measurement),
                        prev_point.get("timestamp"),
                        thresholds,
                    )
                )

            # A baseline from before a data gap compares morning with last night: diurnal change, not a spike.
            max_age = timedelta(minutes=thresholds.get("SPIKE", {}).get("max_history_age_minutes", 180))
            recent = [h[measurement] for h in ctx.history if h.get(measurement) is not None and ctx.timestamp - h["timestamp"] <= max_age]
            results.append(spike.evaluate_spike(measurement, value, recent, thresholds))
            results.append(persistence.evaluate_persistence(measurement, value, history_values, thresholds))
            results.append(persistence.evaluate_stuck_sensor(measurement, value, history_values, thresholds))

            history_pairs = [(h["timestamp"], h[measurement]) for h in ctx.history if h.get(measurement) is not None]
            results.append(drift.evaluate(measurement, value, ctx.timestamp, history_pairs, thresholds))

            # A dropout is a sensor that was reporting and stopped. A measurement this station
            # has not reported recently (no sensor, or not in its feed, e.g. IMD rainfall) is not one.
            # Wind direction is undefined in calm air, so a blank direction at 0 m/s is not a dropout.
            calm = measurement == "wind_direction_deg" and ctx.measurements.get("wind_speed_ms") == 0
            # IMD rainfall is derived from a running total and is blank whenever the previous slot
            # is missing; a rain gauge that truly stops sends nothing and shows up as a telemetry gap.
            derived = measurement == "rainfall_mm"
            if (value is not None or history_values) and not calm and not derived:
                results.append(dropout.evaluate_dropout(measurement, value, thresholds))

        results.append(dropout.evaluate_telemetry_gap(ctx.timestamp, ctx.last_observation_timestamp, thresholds))
        results.append(cross_variable.evaluate_cross_variable(ctx.measurements, thresholds))
        results.append(cross_variable.evaluate_rain_accumulation(ctx.measurements.get("rainfall_mm"), thresholds))
        results.append(cross_variable.evaluate_timestamp_anomaly(ctx.timestamp, ctx.received_at, thresholds))

        return results

    @staticmethod
    def aggregate_score(results: list[RuleResult]) -> float:
        triggered = [r.score for r in results if r.triggered]
        return max(triggered) if triggered else 0.0
