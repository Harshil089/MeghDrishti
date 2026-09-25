"""Assembles the full engineered feature set for one observation."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.features import historical, spatial, temporal

MEASUREMENTS = [
    "temperature_c",
    "humidity_pct",
    "pressure_hpa",
    "rainfall_mm",
    "wind_speed_ms",
    "wind_direction_deg",
]


@dataclass
class FeatureInputs:
    timestamp: datetime
    measurements: dict[str, float | None]
    history: list[dict]  # most-recent-first: [{"timestamp": dt, measurement: value, ...}]
    same_hour_history: dict[str, list[float]] = field(default_factory=dict)
    same_month_history: dict[str, list[float]] = field(default_factory=dict)
    neighbor_values: dict[str, list[float]] = field(default_factory=dict)
    expected_interval_minutes: float = 15.0


class FeatureBuilder:
    def build(self, inputs: FeatureInputs) -> tuple[dict, float]:
        features: dict[str, dict] = {}
        present = 0

        for measurement in MEASUREMENTS:
            current = inputs.measurements.get(measurement)
            if current is not None:
                present += 1

            history_pairs = [(h["timestamp"], h[measurement]) for h in inputs.history if h.get(measurement) is not None]
            history_values = [v for _, v in history_pairs]

            m: dict = {
                "value": current,
                "delta_5m": temporal.delta(current, history_pairs, inputs.timestamp, 5),
                "delta_15m": temporal.delta(current, history_pairs, inputs.timestamp, 15),
                "delta_1h": temporal.delta(current, history_pairs, inputs.timestamp, 60),
                "rate_of_change": temporal.rate_of_change(current, history_pairs, inputs.timestamp),
                "consecutive_identical_count": temporal.consecutive_identical_count(current, history_values),
                "time_since_last_change": temporal.time_since_last_change(current, history_pairs, inputs.timestamp),
                "missing_interval_count": temporal.missing_interval_count(
                    [h["timestamp"] for h in inputs.history], inputs.timestamp, inputs.expected_interval_minutes, 60
                ),
                "station_z_score": historical.station_z_score(current, history_values),
                "historical_same_hour_mean": historical.historical_mean(inputs.same_hour_history.get(measurement, [])),
                "historical_same_month_mean": historical.historical_mean(inputs.same_month_history.get(measurement, [])),
                **temporal.rolling_stats(history_values),
                **spatial.neighbor_stats(current, inputs.neighbor_values.get(measurement, [])),
            }
            features[measurement] = m

        completeness_pct = round(100.0 * present / len(MEASUREMENTS), 2)
        return features, completeness_pct
