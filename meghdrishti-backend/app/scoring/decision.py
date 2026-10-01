"""Final decision engine: fusion + confidence + ExtremeEventGuard + reason codes.

The ExtremeEventGuard preserves corroborated weather extremes. Context cannot
explain impossible values or operational faults, and conflicting sources
require investigation rather than an automatic weather/fault verdict.
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
        observation_source: str | None = None,
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
        context_agreement_avg = (
            sum(other_agreements) / len(other_agreements) if other_agreements else None
        )
        context_mismatch = (
            (1.0 - context_agreement_avg) if context_agreement_avg is not None else 0.0
        )

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
        overall_context_agreement = (
            context_result.extreme_weather_score if context_result and context_available else None
        )

        operational_rules = [
            r
            for r in rule_results
            if r.triggered
            and (
                r.rule in {"DROPOUT", "TELEMETRY_GAP", "TIMESTAMP_ANOMALY"}
                or r.evidence.get("physically_impossible")
            )
        ]
        operational_score = max((r.score for r in operational_rules), default=0.0)
        # Missing layers must not dilute a strong available signal into NORMAL.
        anomaly_detected = (
            fault_score >= thresholds["WATCH"]
            or rule_score >= thresholds["WATCH"]
            or bool(ml_result and ml_result.is_anomalous)
        )
        strong_anomaly_evidence = max(rule_score, ml_score) >= STRONG_ANOMALY_EVIDENCE
        context_scores = [v for v in [neighbor_agreement, *other_agreements] if v is not None]
        context_conflict = bool(context_scores) and (
            min(context_scores) <= STRONG_CONTEXT_DISAGREEMENT
            and max(context_scores) >= STRONG_CONTEXT_AGREEMENT
        )

        classification: str
        if operational_rules and all(r.rule == "TELEMETRY_GAP" for r in operational_rules):
            # Missing collection intervals cannot identify which component failed.
            classification = "INSUFFICIENT_CONTEXT"
        elif operational_rules:
            classification = (
                "PROBABLE_SENSOR_FAULT" if operational_score >= STRONG_ANOMALY_EVIDENCE else "WATCH"
            )
        elif anomaly_detected:
            if context_conflict:
                classification = "SUSPICIOUS" if strong_anomaly_evidence else "WATCH"
            elif (
                strong_anomaly_evidence
                and context_available
                and overall_context_agreement is not None
                and overall_context_agreement >= STRONG_CONTEXT_AGREEMENT
            ):
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
                if classification == "NORMAL":
                    classification = "WATCH"
        else:
            classification = "NORMAL" if fault_score < thresholds["WATCH"] else "WATCH"
        if observation_source in {"OPEN_METEO", "ERA5", "NASA_GPM"} and classification == "PROBABLE_SENSOR_FAULT":
            classification = "SUSPICIOUS"

        severity = severity_for_classification(classification, fault_score)

        evidence_source_count = sum(
            [
                1 if rule_results else 0,
                1 if ml_result is not None else 0,
                1 if neighbor_agreement is not None else 0,
                1 if context_agreement_avg is not None else 0,
            ]
        )
        agreement_values = [
            v
            for v in [
                rule_score if rule_results else None,
                ml_score if ml_result else None,
                neighbor_mismatch if neighbor_agreement is not None else None,
                context_mismatch if context_agreement_avg is not None else None,
            ]
            if v is not None
        ]
        agreement = (
            1.0 - (max(agreement_values) - min(agreement_values))
            if len(agreement_values) > 1
            else 0.0
        )

        confidence = compute_confidence(
            ConfidenceInputs(
                evidence_source_count=evidence_source_count,
                agreement=max(0.0, min(1.0, agreement)),
                context_available=context_available,
                model_reliability=model_reliability if ml_result else 0.0,
                station_data_completeness_pct=station_data_completeness_pct,
                station_historical_quality=station_historical_quality,
            )
        )

        reason_codes = collect_reason_codes(rule_results, ml_result, context_result)
        if context_conflict:
            reason_codes.append("CONTEXT_CONFLICT")
        if operational_rules and all(r.rule == "TELEMETRY_GAP" for r in operational_rules):
            reason_codes.append("COLLECTION_GAP_UNATTRIBUTED")

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
                "operational_score": operational_score,
                "evidence_source_count": evidence_source_count,
                "confidence_is_calibrated": False,
                "context_conflict": context_conflict,
                "observation_source": observation_source,
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
