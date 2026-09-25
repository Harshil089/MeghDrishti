"""Spatial (neighbor-comparison) feature generation."""
from __future__ import annotations

import statistics


def neighbor_stats(current: float | None, neighbor_values: list[float]) -> dict[str, float | None]:
    values = [v for v in neighbor_values if v is not None]
    if not values:
        return {"neighbor_median": None, "neighbor_mean": None, "neighbor_deviation": None}
    median = statistics.median(values)
    mean = statistics.fmean(values)
    deviation = round(current - median, 4) if current is not None else None
    return {
        "neighbor_median": round(median, 4),
        "neighbor_mean": round(mean, 4),
        "neighbor_deviation": deviation,
    }
