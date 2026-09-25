"""Final decision engine: fusion + confidence + ExtremeEventGuard + reason codes.

The ExtremeEventGuard is the component that keeps a genuinely extreme
observation from being auto-labelled a sensor fault: strong contextual
agreement always wins over a high anomaly score.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.context.engine import ContextResultData
from app.ml.inference import MLInferenceResult
from app.schemas.qc import RuleResult
from app.scoring.confidence import ConfidenceInputs, compute_confidence
from app.scoring.defaults import (
    DEFAULT_DECISION_THRESHOLDS,
    STRONG_ANOMALY_EVIDENCE,
    STRONG_CONTEXT_AGREEMENT,
    STRONG_CONTEXT_DISAGREEMENT,
)
from app.scoring.fusion import FusionInputs, compute_fault_score
from app.scoring.reasons import collect_reason_codes
from app.scoring.severity import severity_for_classification


@dataclass
class DecisionResult:
    classification: str
    severity: str
    fault_score: float
    confidence: float
    reason_codes: list[str]
    evidence: dict = field(default_factory=dict)


class DecisionEngine:
    def decide(
        self,
        rule_results: list[RuleResult],
        ml_result: MLInferenceResult | None,
        context_result: ContextResultData | None,
        telemetry_score: float = 0.0,
        station_data_completeness_pct: float = 100.0,
        station_historical_quality: float = 0.5,
        model_reliability: float = 0.5,
        fusion_weights: dict | None = None,
        decision_thresholds: dict | None = None,
    ) -> DecisionResult:
        thresholds = {**DEFAULT_DECISION_THRESHOLDS, **(decision_thresholds or {})}

        rule_score = max((r.score for r in rule_results if r.triggered), default=0.0)
        ml_score = ml_result.normalized_anomaly_score if ml_result else 0.0

        neighbor_agreement = context_result.spatial_consistency if context_result else None
        neighbor_mismatch = (1.0 - neighbor_agreement) if neighbor_agreement is not None else 0.0

        other_agreements = [
            c
            for c in [
                context_result.forecast_consistency if context_result else None,
                context_result.era5_consistency if context_result else None,
                context_result.gpm_consistency if context_result else None,
            ]
            if c is not None
        ]
        context_agreement_avg = sum(other_agreements) / len(other_agreements) if other_agreements else None
        context_mismatch = (1.0 - context_agreement_avg) if context_agreement_avg is not None else 0.0

        fault_score = compute_fault_score(
            FusionInputs(
                rule_score=rule_score,
                ml_score=ml_score,
                neighbor_mismatch=neighbor_mismatch,
                context_mismatch=context_mismatch,
                telemetry_score=telemetry_score,
            ),
            fusion_weights,
        )

        context_available = context_result.external_context_available if context_result else False
        overall_context_agreement = context_result.extreme_weather_score if context_result and context_available else None

        anomaly_detected = fault_score >= thresholds["WATCH"]
        strong_anomaly_evidence = max(rule_score, ml_score) >= STRONG_ANOMALY_EVIDENCE

        classification: str
        if anomaly_detected:
            if context_available and overall_context_agreement is not None and overall_context_agreement >= STRONG_CONTEXT_AGREEMENT:
                classification = "LIKELY_GENUINE_EXTREME"
            elif (
                strong_anomaly_evidence
                and context_available
                and overall_context_agreement is not None
                and overall_context_agreement <= STRONG_CONTEXT_DISAGREEMENT
            ):
                classification = "PROBABLE_SENSOR_FAULT"
            elif not context_available:
                classification = "INSUFFICIENT_CONTEXT" if strong_anomaly_evidence else "SUSPICIOUS"
            else:
                classification = self._threshold_classification(fault_score, thresholds)
        else:
            classification = "NORMAL" if fault_score < thresholds["WATCH"] else "WATCH"

        severity = severity_for_classification(classification, fault_score)

        evidence_source_count = sum(
            [
                1 if rule_score > 0 else 0,
                1 if ml_result is not None else 0,
                1 if neighbor_agreement is not None else 0,
                1 if context_agreement_avg is not None else 0,
            ]
        )
        agreement_values = [v for v in [rule_score, ml_score, neighbor_mismatch, context_mismatch] if v is not None]
        agreement = 1.0 - (max(agreement_values) - min(agreement_values)) if len(agreement_values) > 1 else 0.5

        confidence = compute_confidence(
            ConfidenceInputs(
                evidence_source_count=evidence_source_count,
                agreement=max(0.0, min(1.0, agreement)),
                context_available=context_available,
                model_reliability=model_reliability,
                station_data_completeness_pct=station_data_completeness_pct,
                station_historical_quality=station_historical_quality,
            )
        )

        reason_codes = collect_reason_codes(rule_results, ml_result, context_result)

        return DecisionResult(
            classification=classification,
            severity=severity,
            fault_score=fault_score,
            confidence=confidence,
            reason_codes=reason_codes,
            evidence={
                "rule_score": rule_score,
                "ml_score": ml_score,
                "neighbor_mismatch": neighbor_mismatch,
                "context_mismatch": context_mismatch,
                "telemetry_score": telemetry_score,
                "context_available": context_available,
                "overall_context_agreement": overall_context_agreement,
            },
        )

    @staticmethod
    def _threshold_classification(fault_score: float, thresholds: dict) -> str:
        if fault_score >= thresholds["PROBABLE_SENSOR_FAULT"]:
            return "PROBABLE_SENSOR_FAULT"
        if fault_score >= thresholds["SUSPICIOUS"]:
            return "SUSPICIOUS"
        if fault_score >= thresholds["WATCH"]:
            return "WATCH"
        return "NORMAL"
