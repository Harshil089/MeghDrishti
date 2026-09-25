"""Context validation engine: does external evidence support an unusual observation?

Critically distinguishes "no external context available" from "external
context disagrees" — these must never be conflated.
"""
from __future__ import annotations

from dataclasses import dataclass, field

TOLERANCES = {
    "temperature_c": 3.0,
    "humidity_pct": 20.0,
    "pressure_hpa": 5.0,
    "rainfall_mm": 15.0,
    "wind_speed_ms": 5.0,
    "wind_direction_deg": 45.0,
}


def _consistency(observed: float | None, reference: float | None, tolerance: float) -> float | None:
    if observed is None or reference is None:
        return None
    diff = abs(observed - reference)
    return round(max(0.0, 1.0 - diff / tolerance), 4)


@dataclass
class ContextInputs:
    measurement: str
    observed_value: float | None
    neighbor_median: float | None = None
    forecast_value: float | None = None
    era5_value: float | None = None
    gpm_value: float | None = None


@dataclass
class ContextResultData:
    spatial_consistency: float | None
    forecast_consistency: float | None
    era5_consistency: float | None
    gpm_consistency: float | None
    external_context_available: bool
    extreme_weather_score: float | None
    evidence: dict = field(default_factory=dict)


class ContextEngine:
    def evaluate(self, inputs: ContextInputs) -> ContextResultData:
        tolerance = TOLERANCES.get(inputs.measurement, 5.0)

        spatial = _consistency(inputs.observed_value, inputs.neighbor_median, tolerance)
        forecast = _consistency(inputs.observed_value, inputs.forecast_value, tolerance)
        era5 = _consistency(inputs.observed_value, inputs.era5_value, tolerance)
        gpm = _consistency(inputs.observed_value, inputs.gpm_value, tolerance) if inputs.measurement == "rainfall_mm" else None

        available_scores = [s for s in [spatial, forecast, era5, gpm] if s is not None]
        external_context_available = len(available_scores) > 0

        extreme_weather_score = round(sum(available_scores) / len(available_scores), 4) if available_scores else None

        return ContextResultData(
            spatial_consistency=spatial,
            forecast_consistency=forecast,
            era5_consistency=era5,
            gpm_consistency=gpm,
            external_context_available=external_context_available,
            extreme_weather_score=extreme_weather_score,
            evidence={
                "measurement": inputs.measurement,
                "observed_value": inputs.observed_value,
                "neighbor_median": inputs.neighbor_median,
                "forecast_value": inputs.forecast_value,
                "era5_value": inputs.era5_value,
                "gpm_value": inputs.gpm_value,
                "tolerance": tolerance,
            },
        )
