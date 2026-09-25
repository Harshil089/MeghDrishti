from app.context.engine import ContextResultData
from app.ml.inference import MLInferenceResult
from app.scoring.decision import DecisionEngine
from app.schemas.qc import RuleResult


def test_genuine_extreme_rainfall_not_labelled_sensor_fault():
    """Section 35: Pune 182mm/15min rainfall confirmed by neighbors, GPM, forecast."""
    rule_results = [
        RuleResult(rule="RAIN_ACCUMULATION", triggered=True, score=0.98, severity="CRITICAL", reason_code="RAINFALL_EXTREME"),
    ]
    ml_result = MLInferenceResult(
        model_version="v1", raw_score=5.0, normalized_anomaly_score=0.97, threshold=0.5, is_anomalous=True,
        features_used={"value": 182.0},
    )
    context_result = ContextResultData(
        spatial_consistency=0.9,
        forecast_consistency=0.85,
        era5_consistency=None,
        gpm_consistency=0.92,
        external_context_available=True,
        extreme_weather_score=0.89,
        evidence={},
    )

    result = DecisionEngine().decide(rule_results, ml_result, context_result)

    assert result.classification == "LIKELY_GENUINE_EXTREME"
    assert result.severity in ("HIGH", "CRITICAL")
    assert "RAINFALL_EXTREME" in result.reason_codes
    assert "GPM_CONFIRMED" in result.reason_codes
    assert "NEIGHBOR_CONFIRMED" in result.reason_codes


def test_sensor_fault_correctly_identified_on_disagreement():
    """Section 36: 49.2C spike vs 31.7C neighbor median, 32.1C forecast, 31.5C ERA5."""
    rule_results = [
        RuleResult(rule="SPIKE", triggered=True, score=0.9, severity="CRITICAL", reason_code="TEMP_SPIKE"),
        RuleResult(rule="RATE_OF_CHANGE", triggered=True, score=0.85, severity="CRITICAL", reason_code="RATE_OF_CHANGE_EXCEEDED"),
    ]
    ml_result = MLInferenceResult(
        model_version="v1", raw_score=4.0, normalized_anomaly_score=0.96, threshold=0.5, is_anomalous=True,
        features_used={"value": 49.2},
    )
    context_result = ContextResultData(
        spatial_consistency=0.1,
        forecast_consistency=0.15,
        era5_consistency=0.12,
        gpm_consistency=None,
        external_context_available=True,
        extreme_weather_score=0.12,
        evidence={},
    )

    result = DecisionEngine().decide(rule_results, ml_result, context_result)

    assert result.classification == "PROBABLE_SENSOR_FAULT"
    assert result.severity in ("HIGH", "CRITICAL")
    assert "TEMP_SPIKE" in result.reason_codes
    assert "MODEL_HIGH_ANOMALY_SCORE" in result.reason_codes
    assert "NEIGHBOR_MISMATCH" in result.reason_codes
    assert "FORECAST_MISMATCH" in result.reason_codes
    assert "ERA5_MISMATCH" in result.reason_codes


def test_missing_context_is_insufficient_context_not_mismatch():
    rule_results = [RuleResult(rule="SPIKE", triggered=True, score=0.9, severity="CRITICAL", reason_code="TEMP_SPIKE")]
    ml_result = MLInferenceResult(
        model_version="v1", raw_score=4.0, normalized_anomaly_score=0.9, threshold=0.5, is_anomalous=True, features_used={},
    )
    result = DecisionEngine().decide(rule_results, ml_result, context_result=None)

    assert result.classification == "INSUFFICIENT_CONTEXT"
    assert "INSUFFICIENT_CONTEXT" in result.reason_codes
    assert "NEIGHBOR_MISMATCH" not in result.reason_codes


def test_low_evidence_single_source_yields_low_confidence():
    rule_results = [RuleResult(rule="PERSISTENCE", triggered=True, score=0.45, severity="MEDIUM", reason_code="VALUE_PERSISTED")]
    result = DecisionEngine().decide(rule_results, ml_result=None, context_result=None)
    # single weak source, no ML, no context -> should not produce high confidence
    assert result.confidence < 0.6


def test_normal_observation_classified_normal():
    result = DecisionEngine().decide([], None, None)
    assert result.classification == "NORMAL"
    assert result.fault_score == 0.0
