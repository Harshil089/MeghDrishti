"""Spatial (neighbor-comparison) feature generation."""

from __future__ import annotations

import math
import statistics


def neighbor_stats(
    current: float | None, neighbor_values: list[float], circular: bool = False
) -> dict[str, float | None]:
    values = [v for v in neighbor_values if v is not None]
    if not values:
        return {"neighbor_median": None, "neighbor_mean": None, "neighbor_deviation": None}
    median = statistics.median(values)
    mean = statistics.fmean(values)
    deviation = round(current - median, 4) if current is not None else None
    if circular:
        x = sum(math.cos(math.radians(v)) for v in values)
        y = sum(math.sin(math.radians(v)) for v in values)
        if math.hypot(x, y) < 1e-9:
            return {"neighbor_median": None, "neighbor_mean": None, "neighbor_deviation": None}
        mean = math.degrees(math.atan2(y, x)) % 360
        offsets = [(v - mean + 180) % 360 - 180 for v in values]
        median = (mean + statistics.median(offsets)) % 360
        deviation = round((current - median + 180) % 360 - 180, 4) if current is not None else None
    return {
        "neighbor_median": round(median, 4),
        "neighbor_mean": round(mean, 4),
        "neighbor_deviation": deviation,
    }
