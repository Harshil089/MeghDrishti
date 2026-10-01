"""Candidate model evaluation. Computed before any activation decision."""

from __future__ import annotations

from app.ml.training import TrainedModel, build_feature_matrix


def evaluate_candidate(
    model: TrainedModel,
    feature_rows: list[dict[str, float | None]],
    labels: list[bool | None] | None = None,
) -> dict:
    if labels is not None and len(labels) != len(feature_rows):
        raise ValueError("Labels must correspond to feature rows")
    valid_indices = [
        i
        for i, row in enumerate(feature_rows)
        if len(build_feature_matrix([row], model.feature_names))
    ]
    X = build_feature_matrix(feature_rows, model.feature_names)
    if X.shape[0] == 0:
        return {"n_samples": 0, "anomaly_rate": None, "score_mean": None, "score_std": None}

    raw_scores = -model.estimator.score_samples(X)
    is_anomalous = raw_scores >= model.threshold

    metrics = {
        "n_samples": int(X.shape[0]),
        "anomaly_rate": round(float(is_anomalous.mean()), 4),
        "score_mean": round(float(raw_scores.mean()), 4),
        "score_std": round(float(raw_scores.std()), 4),
        "threshold": round(model.threshold, 4),
    }
    reviewed = [
        (bool(is_anomalous[j]), labels[i])
        for j, i in enumerate(valid_indices)
        if labels is not None and labels[i] is not None
    ]
    tp = sum(pred and label for pred, label in reviewed)
    fp = sum(pred and not label for pred, label in reviewed)
    fn = sum(not pred and label for pred, label in reviewed)
    metrics.update(
        {
            "labelled_samples": len(reviewed),
            "accuracy": round(sum(pred == label for pred, label in reviewed) / len(reviewed), 4)
            if reviewed
            else None,
            "precision": round(tp / (tp + fp), 4) if tp + fp else None,
            "recall": round(tp / (tp + fn), 4) if tp + fn else None,
            "label_metric_target": "anomaly flag against operator-confirmed sensor fault",
        }
    )
    return metrics
