"""Temporal feature generation: deltas, rolling stats, rate of change, stuck-value counters.

All functions return None for a feature that cannot be computed with the
available history — missing data is never silently replaced with zero.
"""
from __future__ import annotations

import statistics
from datetime import datetime


def _value_at_or_before(history: list[tuple[datetime, float]], now: datetime, minutes_ago: float) -> float | None:
    target = now.timestamp() - minutes_ago * 60
    best = None
    best_diff = None
    for ts, value in history:
        diff = abs(ts.timestamp() - target)
        if diff <= minutes_ago * 60 * 0.5 and (best_diff is None or diff < best_diff):
            best, best_diff = value, diff
    return best


def delta(current: float | None, history: list[tuple[datetime, float]], now: datetime, minutes_ago: float) -> float | None:
    if current is None:
        return None
    ref = _value_at_or_before(history, now, minutes_ago)
    if ref is None:
        return None
    return round(current - ref, 4)


def rolling_stats(values: list[float]) -> dict[str, float | None]:
    if not values:
        return {"rolling_mean": None, "rolling_median": None, "rolling_std": None, "rolling_min": None, "rolling_max": None}
    return {
        "rolling_mean": round(statistics.fmean(values), 4),
        "rolling_median": round(statistics.median(values), 4),
        "rolling_std": round(statistics.pstdev(values), 4) if len(values) > 1 else 0.0,
        "rolling_min": round(min(values), 4),
        "rolling_max": round(max(values), 4),
    }


def rate_of_change(current: float | None, history: list[tuple[datetime, float]], now: datetime) -> float | None:
    if current is None or not history:
        return None
    prev_ts, prev_value = history[0]
    minutes = (now - prev_ts).total_seconds() / 60.0
    if minutes <= 0:
        return None
    return round((current - prev_value) / minutes, 4)


def consecutive_identical_count(current: float | None, history: list[float], tolerance: float = 1e-9) -> int:
    if current is None:
        return 0
    count = 1
    for v in history:
        if v is None or abs(v - current) > tolerance:
            break
        count += 1
    return count


def time_since_last_change(
    current: float | None, history: list[tuple[datetime, float]], now: datetime, tolerance: float = 1e-9
) -> float | None:
    if current is None or not history:
        return None
    last_ts = now
    for ts, value in history:
        if value is None or abs(value - current) > tolerance:
            break
        last_ts = ts
    minutes = (now - last_ts).total_seconds() / 60.0
    return round(minutes, 2) if minutes > 0 else 0.0


def missing_interval_count(
    history_timestamps: list[datetime], now: datetime, expected_interval_minutes: float, window_minutes: float
) -> int | None:
    if expected_interval_minutes <= 0:
        return None
    expected_count = max(1, int(window_minutes / expected_interval_minutes))
    cutoff = now.timestamp() - window_minutes * 60
    actual_count = sum(1 for ts in history_timestamps if ts.timestamp() >= cutoff)
    return max(0, expected_count - actual_count)
