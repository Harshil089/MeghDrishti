"""Historical-baseline features: same-hour/same-month climatology and station z-score."""
from __future__ import annotations

import statistics


def historical_mean(values: list[float]) -> float | None:
    return round(statistics.fmean(values), 4) if values else None


def station_z_score(current: float | None, history: list[float]) -> float | None:
    if current is None or len(history) < 5:
        return None
    mean = statistics.fmean(history)
    stdev = statistics.pstdev(history)
    if stdev == 0:
        return 0.0
    return round((current - mean) / stdev, 4)
