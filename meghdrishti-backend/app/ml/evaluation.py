"""Candidate model evaluation. Computed before any activation decision."""
from __future__ import annotations

from app.ml.training import TrainedModel, build_feature_matrix


def evaluate_candidate(model: TrainedModel, feature_rows: list[dict[str, float | None]]) -> dict:
    X = build_feature_matrix(feature_rows, model.feature_names)
    if X.shape[0] == 0:
        return {"n_samples": 0, "anomaly_rate": None, "score_mean": None, "score_std": None}

    raw_scores = -model.estimator.score_samples(X)
    is_anomalous = raw_scores >= model.threshold

    return {
        "n_samples": int(X.shape[0]),
        "anomaly_rate": round(float(is_anomalous.mean()), 4),
        "score_mean": round(float(raw_scores.mean()), 4),
        "score_std": round(float(raw_scores.std()), 4),
        "threshold": round(model.threshold, 4),
    }
