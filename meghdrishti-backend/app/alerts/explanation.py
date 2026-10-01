"""Explain persisted decisions using recorded facts, without inventing evidence."""
from __future__ import annotations

from math import isfinite

MEASUREMENTS = {
    "temperature_c": ("Temperature", "°C"), "humidity_pct": ("Humidity", "%"),
    "pressure_hpa": ("Pressure", " hPa"), "rainfall_mm": ("Rainfall", " mm"),
    "wind_speed_ms": ("Wind speed", " m/s"), "wind_direction_deg": ("Wind direction", "°"),
}
CLASSIFICATIONS = {
    "NORMAL": "Within expected range", "WATCH": "Needs monitoring",
    "SUSPICIOUS": "Suspicious reading; not a confirmed fault",
    "PROBABLE_SENSOR_FAULT": "Probable sensor or data fault; operator confirmation needed",
    "LIKELY_GENUINE_EXTREME": "Likely genuine extreme weather, supported by available context",
    "INSUFFICIENT_CONTEXT": "Unusual reading; insufficient context to distinguish weather from a fault",
}


def number(value) -> str:
    return f"{value:g}" if isinstance(value, (int, float)) and isfinite(value) else "unavailable"


def explain(anomaly, observation, evidence: dict, raw_payload: dict | None = None) -> dict:
    measurement = anomaly.measurement
    label, unit = MEASUREMENTS.get(measurement, (measurement or "Measurement", ""))
    if measurement == "wind_speed_ms" and observation and observation.source == "OPEN_METEO" and (raw_payload or {}).get("wind_speed_unit") != "m/s":
        unit = " (historical unit unverified)"
    value = getattr(observation, measurement, None) if observation and measurement in MEASUREMENTS else None
    reading = f"{label}: {number(value)}{unit if value is not None else ''}"
    findings = []
    for rule in evidence.get("RULE", []):
        if not rule.get("triggered", True):
            continue
        e, name = rule.get("evidence", {}), rule.get("rule")
        if name == "RATE_OF_CHANGE":
            text = f"Changed {number(e.get('delta'))}{unit} in {number(e.get('minutes'))} minutes; rate {number(e.get('rate_per_5min'))}{unit}/5 min exceeds limit {number(e.get('max_per_5min'))}{unit}/5 min."
        elif name == "SPIKE":
            text = f"Spike relative to historical mean {number(e.get('mean'))}{unit}; z-score {number(e.get('z_score'))}."
        elif name == "PHYSICAL_RANGE":
            text = "Reading violates a physical/unit constraint." if e.get("physically_impossible") else f"Outside configured range {number(e.get('min'))}–{number(e.get('max'))}{unit}."
        elif name in {"PERSISTENCE", "STUCK_SENSOR"}:
            text = f"Repeated nearly identical values for {number(e.get('consecutive_identical_count'))} readings ({name.replace('_', ' ').lower()})."
        elif name == "GRADUAL_DRIFT":
            text = f"Trend {number(e.get('slope_per_hour'))}{unit}/hour; configured drift threshold {number(e.get('threshold_per_hour'))}{unit}/hour."
        elif name == "DROPOUT":
            text = f"{label} reading is missing."
        elif name == "TELEMETRY_GAP":
            text = f"Reporting gap {number(e.get('gap_minutes'))} minutes; expected interval {number(e.get('expected_interval_minutes'))} minutes."
        elif name == "TIMESTAMP_ANOMALY":
            text = f"Timestamp is {number(e.get('skew_minutes'))} minutes ahead of receipt; allowed skew {number(e.get('max_future_skew_minutes'))} minutes."
        elif name == "RAIN_ACCUMULATION":
            text = f"Rainfall {number(e.get('rainfall_mm'))} mm exceeds extreme threshold {number(e.get('extreme_threshold_mm'))} mm for the observation interval."
        elif name == "CROSS_VARIABLE_CONSISTENCY":
            text = f"Rainfall {number(e.get('rainfall_mm'))} mm with humidity {number(e.get('humidity_pct'))}%; configured minimum humidity during rainfall is {number(e.get('min_expected_humidity_pct'))}%."
        else:
            text = (rule.get("reason_code") or name or "Recorded rule flag").replace("_", " ").capitalize()
        findings.append(text)
    ml = evidence.get("ML", {})
    if ml:
        findings.append(f"ML anomaly score {number(ml.get('raw_score'))}; threshold {number(ml.get('threshold'))}. This score is not a fault probability.")
    ctx = evidence.get("CONTEXT", {})
    refs = ctx.get("evidence", {})
    context = []
    for name, field, score in [
        ("Nearby-station median", "neighbor_median", "spatial_consistency"),
        ("Forecast", "forecast_value", "forecast_consistency"),
        ("ERA5", "era5_value", "era5_consistency"), ("GPM", "gpm_value", "gpm_consistency"),
    ]:
        if ctx.get(score) is not None:
            reference = f"{number(refs[field])}{unit}; " if refs.get(field) is not None else ""
            context.append(f"{name}: {reference}consistency {number(ctx[score])}/1 (higher means closer agreement).")
    if not context:
        context.append("No external comparison evidence recorded; weather versus fault remains uncertain.")
    if evidence.get("DECISION", {}).get("context_conflict"):
        context.append("Context sources conflict; investigate rather than treating their average as confirmation.")
    classification = CLASSIFICATIONS.get(anomaly.classification, anomaly.classification)
    quality_notes = []
    if evidence.get("DECISION", {}).get("policy_version") != 2:
        quality_notes.append("Legacy decision: source histories and provider self-comparisons may affect this classification. Not revalidated.")
    return {
        "summary": f"{reading}. {findings[0] if findings else 'No detailed rule evidence recorded.'} {'Recorded legacy classification: ' if evidence.get('DECISION', {}).get('policy_version') != 2 else ''}{classification}.",
        "quality_notes": quality_notes,
        "reading": reading, "classification": classification,
        "source": observation.source if observation else None,
        "observed_at": observation.timestamp.isoformat() if observation else None,
        "findings": findings, "context": context,
    }
