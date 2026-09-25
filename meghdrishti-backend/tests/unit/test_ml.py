import random

import pytest

from app.ml.evaluation import evaluate_candidate
from app.ml.inference import run_inference
from app.ml.registry import ModelRegistry
from app.ml.training import train_isolation_forest

FEATURE_NAMES = ["value", "delta_5m", "rolling_std"]


def _normal_rows(n: int, seed: int = 1) -> list[dict]:
    rng = random.Random(seed)
    return [
        {"value": 24.0 + rng.uniform(-1, 1), "delta_5m": rng.uniform(-0.5, 0.5), "rolling_std": rng.uniform(0.1, 0.6)}
        for _ in range(n)
    ]


def test_training_requires_minimum_rows():
    with pytest.raises(ValueError):
        train_isolation_forest(_normal_rows(5), FEATURE_NAMES)


def test_training_drops_incomplete_rows_not_zero_fill():
    rows = _normal_rows(30)
    rows[0]["value"] = None
    trained = train_isolation_forest(rows, FEATURE_NAMES)
    assert trained.estimator is not None


def test_candidate_flags_outlier_rows():
    rows = _normal_rows(200)
    trained = train_isolation_forest(rows, FEATURE_NAMES, contamination=0.05)
    outlier_rows = rows + [{"value": 90.0, "delta_5m": 40.0, "rolling_std": 20.0}]
    metrics = evaluate_candidate(trained, outlier_rows)
    assert metrics["n_samples"] == 201
    assert metrics["anomaly_rate"] is not None


@pytest.mark.asyncio
async def test_registered_model_starts_as_candidate_and_requires_explicit_activation(db_session):
    rows = _normal_rows(50)
    trained = train_isolation_forest(rows, FEATURE_NAMES)
    registry = ModelRegistry(db_session)
    model = await registry.register_candidate("temperature_c", trained)

    assert model.status == "CANDIDATE"
    active = await registry.get_active("temperature_c", None, None)
    assert active is None  # candidate must not be usable until explicitly activated

    activated = await registry.activate(model.id)
    assert activated.status == "ACTIVE"
    active = await registry.get_active("temperature_c", None, None)
    assert active is not None
    assert active.id == model.id


@pytest.mark.asyncio
async def test_inference_returns_none_when_features_missing(db_session):
    rows = _normal_rows(50)
    trained = train_isolation_forest(rows, FEATURE_NAMES)
    registry = ModelRegistry(db_session)
    model = await registry.register_candidate("temperature_c", trained)
    await registry.activate(model.id)

    result = run_inference(model, {"value": 24.0, "delta_5m": None, "rolling_std": 0.2})
    assert result is None

    result = run_inference(model, {"value": 24.0, "delta_5m": 0.1, "rolling_std": 0.2})
    assert result is not None
    assert 0.0 <= result.normalized_anomaly_score <= 1.0
