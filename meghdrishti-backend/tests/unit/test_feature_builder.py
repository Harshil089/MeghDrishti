from datetime import datetime, timedelta, timezone

from app.features.builder import FeatureBuilder, FeatureInputs

BASE = datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc)


def test_insufficient_history_returns_none_not_zero():
    inputs = FeatureInputs(timestamp=BASE, measurements={"temperature_c": 25.0}, history=[])
    features, completeness = FeatureBuilder().build(inputs)
    temp = features["temperature_c"]
    assert temp["value"] == 25.0
    assert temp["delta_5m"] is None
    assert temp["rolling_mean"] is None
    assert temp["station_z_score"] is None


def test_missing_measurement_reduces_completeness():
    inputs = FeatureInputs(timestamp=BASE, measurements={"temperature_c": 25.0}, history=[])
    features, completeness = FeatureBuilder().build(inputs)
    assert features["humidity_pct"]["value"] is None
    assert completeness < 100.0


def test_delta_and_rolling_computed_with_history():
    history = [
        {"timestamp": BASE - timedelta(minutes=5 * (i + 1)), "temperature_c": 24.0 + i * 0.1}
        for i in range(10)
    ]
    inputs = FeatureInputs(timestamp=BASE, measurements={"temperature_c": 26.0}, history=history)
    features, _ = FeatureBuilder().build(inputs)
    temp = features["temperature_c"]
    assert temp["delta_5m"] is not None
    assert temp["rolling_mean"] is not None
    assert temp["rate_of_change"] is not None


def test_neighbor_deviation_computed():
    inputs = FeatureInputs(
        timestamp=BASE,
        measurements={"temperature_c": 49.2},
        history=[],
        neighbor_values={"temperature_c": [31.5, 31.9, 32.0]},
    )
    features, _ = FeatureBuilder().build(inputs)
    temp = features["temperature_c"]
    assert temp["neighbor_median"] == 31.9
    assert temp["neighbor_deviation"] > 15
