"""Loads + caches joblib model artifacts in memory."""
from __future__ import annotations

import joblib
from sklearn.ensemble import IsolationForest

_cache: dict[str, IsolationForest] = {}


def load_estimator(artifact_path: str) -> IsolationForest:
    if artifact_path not in _cache:
        _cache[artifact_path] = joblib.load(artifact_path)
    return _cache[artifact_path]


def clear_cache() -> None:
    _cache.clear()
