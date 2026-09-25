"""Stable, machine-readable reason codes assembled from rule/ML/context evidence."""
from __future__ import annotations

from app.context.engine import ContextResultData
from app.ml.inference import MLInferenceResult
from app.schemas.qc import RuleResult

CONFIRM_THRESHOLD = 0.7
MISMATCH_THRESHOLD = 0.4


def collect_reason_codes(
    rule_results: list[RuleResult],
    ml_result: MLInferenceResult | None,
    context_result: ContextResultData | None,
) -> list[str]:
    codes: list[str] = []

    for r in rule_results:
        if r.triggered and r.reason_code:
            codes.append(r.reason_code)

    if ml_result is not None and ml_result.is_anomalous:
        codes.append("MODEL_HIGH_ANOMALY_SCORE")

    if context_result is None or not context_result.external_context_available:
        codes.append("INSUFFICIENT_CONTEXT")
    else:
        codes.extend(_context_codes("NEIGHBOR", context_result.spatial_consistency))
        codes.extend(_context_codes("FORECAST", context_result.forecast_consistency))
        codes.extend(_context_codes("ERA5", context_result.era5_consistency))
        codes.extend(_context_codes("GPM", context_result.gpm_consistency))

    seen = set()
    deduped = []
    for c in codes:
        if c not in seen:
            seen.add(c)
            deduped.append(c)
    return deduped


def _context_codes(prefix: str, consistency: float | None) -> list[str]:
    if consistency is None:
        return []
    if consistency >= CONFIRM_THRESHOLD:
        return [f"{prefix}_CONFIRMED"]
    if consistency <= MISMATCH_THRESHOLD:
        return [f"{prefix}_MISMATCH"]
    return []
