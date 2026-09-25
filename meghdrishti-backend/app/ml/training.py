"""Isolation Forest training on engineered features (never raw observations)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import IsolationForest


@dataclass
class TrainedModel:
    estimator: IsolationForest
    feature_names: list[str]
    contamination: float
    threshold: float


def build_feature_matrix(feature_rows: list[dict[str, float | None]], feature_names: list[str]) -> np.ndarray:
    """Rows with any missing selected feature are dropped rather than zero-filled."""
    matrix = []
    for row in feature_rows:
        values = [row.get(name) for name in feature_names]
        if any(v is None for v in values):
            continue
        matrix.append(values)
    return np.array(matrix, dtype=float)


def train_isolation_forest(
    feature_rows: list[dict[str, float | None]],
    feature_names: list[str],
    contamination: float = 0.05,
    random_state: int = 42,
) -> TrainedModel:
    X = build_feature_matrix(feature_rows, feature_names)
    if X.shape[0] < 20:
        raise ValueError(f"Insufficient training rows after dropping incomplete features: {X.shape[0]}")

    estimator = IsolationForest(
        contamination=contamination, random_state=random_state, n_estimators=200
    )
    estimator.fit(X)

    raw_scores = -estimator.score_samples(X)  # higher = more anomalous
    threshold = float(np.quantile(raw_scores, 1 - contamination))

    return TrainedModel(
        estimator=estimator, feature_names=feature_names, contamination=contamination, threshold=threshold
    )
