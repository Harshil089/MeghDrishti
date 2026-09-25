"""Isolation Forest inference against the active model for a measurement."""
from __future__ import annotations

import time

import numpy as np

from app.core.metrics import model_inference_duration_seconds
from app.ml.loader import load_estimator
from app.models.ml import ModelVersion


class MLInferenceResult:
    def __init__(
        self,
        model_version: str,
        raw_score: float,
        normalized_anomaly_score: float,
        threshold: float,
        is_anomalous: bool,
        features_used: dict,
    ):
        self.model_version = model_version
        self.raw_score = raw_score
        self.normalized_anomaly_score = normalized_anomaly_score
        self.threshold = threshold
        self.is_anomalous = is_anomalous
        self.features_used = features_used


def run_inference(model_row: ModelVersion, features: dict[str, float | None]) -> MLInferenceResult | None:
    values = [features.get(name) for name in model_row.feature_names]
    if any(v is None for v in values):
        return None  # insufficient features — caller must treat as "no ML evidence", not a score

    estimator = load_estimator(model_row.artifact_path)
    X = np.array([values], dtype=float)
    start = time.perf_counter()
    raw_score = float(-estimator.score_samples(X)[0])
    model_inference_duration_seconds.labels(measurement=model_row.measurement).observe(time.perf_counter() - start)

    threshold = model_row.threshold or 0.5
    normalized = min(1.0, max(0.0, raw_score / (threshold * 2))) if threshold > 0 else 0.0

    return MLInferenceResult(
        model_version=model_row.model_version,
        raw_score=round(raw_score, 4),
        normalized_anomaly_score=round(normalized, 4),
        threshold=round(threshold, 4),
        is_anomalous=raw_score >= threshold,
        features_used={name: features.get(name) for name in model_row.feature_names},
    )
