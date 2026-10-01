#!/usr/bin/env python
"""Read-only decision evaluation: controlled synthetic cases and operator reviews.

No observations, reviews, calibration profiles or models are changed. Synthetic
scenario agreement is a development diagnostic, never field accuracy.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import subprocess
import sys
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import ModuleType

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.context.engine import ContextEngine, ContextInputs  # noqa: E402
from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.models.anomalies import Anomaly  # noqa: E402
from app.models.reviews import OperatorReview  # noqa: E402
from app.qc.engine import QCContext, QCEngine  # noqa: E402
from app.scoring.decision import DecisionEngine  # noqa: E402


def legacy_module(path: str, baseline: str) -> ModuleType:
    """Compare against a specified Git baseline, without changing checkout files."""
    module = ModuleType("legacy_" + path.replace("/", "_"))
    sys.modules[module.__name__] = module
    source = subprocess.check_output(
        ["git", "show", f"{baseline}:meghdrishti-backend/{path}"], text=True
    )
    exec(compile(source, path, "exec"), module.__dict__)
    return module


def scenarios():
    rng = random.Random(42)
    now = datetime(2026, 10, 1, 12, tzinfo=UTC)
    for _ in range(20):
        t = rng.uniform(26, 34)
        cases = [
            ("normal_temperature", "temperature_c", t, t, "NORMAL"),
            ("dry_weather", "rainfall_mm", 0, 0, "NORMAL"),
            ("calm_wind", "wind_speed_ms", 0, 0, "NORMAL"),
            ("wind_bearing_wrap", "wind_direction_deg", 1, 359, "NORMAL"),
            ("temperature_spike_fault", "temperature_c", t + 17, t, "PROBABLE_SENSOR_FAULT"),
            (
                "impossible_humidity_despite_agreement",
                "humidity_pct",
                rng.uniform(110, 130),
                120,
                "PROBABLE_SENSOR_FAULT",
            ),
            (
                "genuine_extreme_rain",
                "rainfall_mm",
                rng.uniform(120, 200),
                None,
                "LIKELY_GENUINE_EXTREME",
            ),
            ("genuine_heat_extreme", "temperature_c", t + 17, None, "LIKELY_GENUINE_EXTREME"),
            ("moderate_spike_no_context", "temperature_c", t + 4.7, None, "INSUFFICIENT_CONTEXT"),
            ("conflicting_weather_context", "temperature_c", t + 17, None, "SUSPICIOUS"),
            ("future_timestamp", "temperature_c", t, t, "PROBABLE_SENSOR_FAULT"),
            ("missing_temperature", "temperature_c", None, None, "WATCH"),
        ]
        for name, measurement, value, reference, expected in cases:
            reference = value if reference is None else reference
            baseline = (
                t
                if measurement == "temperature_c"
                else (50 if measurement == "humidity_pct" else 0)
            )
            if measurement == "wind_direction_deg":
                baseline = 359
            history = []
            for j in range(24):
                previous = (
                    baseline + rng.uniform(-0.5, 0.5)
                    if measurement in {"temperature_c", "humidity_pct"}
                    else baseline
                )
                if name == "moderate_spike_no_context":
                    previous = t + (-1 if j % 2 else 1)
                history.append(
                    {"timestamp": now - timedelta(minutes=15 * (j + 1)), measurement: previous}
                )
            ctx = QCContext(
                timestamp=now,
                received_at=now - timedelta(minutes=15) if name == "future_timestamp" else now,
                measurements={measurement: value},
                history=history,
                last_observation_timestamp=history[0]["timestamp"],
            )
            inputs = ContextInputs(
                measurement=measurement,
                observed_value=value,
                neighbor_median=reference,
                forecast_value=reference,
            )
            if name == "moderate_spike_no_context":
                inputs = ContextInputs(measurement=measurement, observed_value=value)
            elif name == "conflicting_weather_context":
                inputs.era5_value = t
            yield name, measurement, expected, ctx, inputs


def benchmark(baseline: str) -> dict:
    old_qc = legacy_module("app/qc/engine.py", baseline)
    for name in ("physical", "persistence", "spike", "cross_variable"):
        setattr(old_qc, name, legacy_module(f"app/qc/{name}.py", baseline))
    old_context = legacy_module("app/context/engine.py", baseline)
    old_decision = legacy_module("app/scoring/decision.py", baseline)
    results = []
    for name, measurement, expected, qc_inputs, context_inputs in scenarios():
        predictions = {}
        for label, qc, context, decision in [
            (
                "baseline",
                old_qc.QCEngine(),
                old_context.ContextEngine(),
                old_decision.DecisionEngine(),
            ),
            ("current", QCEngine(), ContextEngine(), DecisionEngine()),
        ]:
            rules = [
                r for r in qc.run(qc_inputs) if r.evidence.get("measurement") in (measurement, None) and measurement in r.evidence.get("measurements", [measurement])
            ]
            predictions[label] = decision.decide(
                rules, None, context.evaluate(context_inputs)
            ).classification
        results.append({"scenario": name, "expected": expected, **predictions})
    groups = {}
    for name in sorted({r["scenario"] for r in results}):
        rows = [r for r in results if r["scenario"] == name]
        groups[name] = {
            "samples": len(rows),
            "expected": rows[0]["expected"],
            **{
                label: {
                    "classifications": dict(Counter(r[label] for r in rows)),
                    "expected_classification_matches": sum(r[label] == r["expected"] for r in rows),
                }
                for label in ("baseline", "current")
            },
        }
    return {
        "data_type": "synthetic controlled scenarios, no ML layer",
        "baseline_commit": subprocess.check_output(
            ["git", "rev-parse", baseline], text=True
        ).strip(),
        "samples": len(results),
        "groups": groups,
        "limitations": [
            "Authored scenarios, not an independent fault dataset",
            "No estimates of field accuracy or model precision/recall",
            "Provider outages, station geography and long-term drift not covered",
        ],
    }


async def reviewed_decisions() -> dict:
    async with AsyncSessionLocal() as session:
        rows = (
            await session.execute(
                select(Anomaly, OperatorReview)
                .join(OperatorReview, OperatorReview.anomaly_id == Anomaly.id)
                .order_by(OperatorReview.created_at.desc(), OperatorReview.id)
            )
        ).all()
    seen, resolved = set(), []
    for anomaly, review in rows:
        if anomaly.id in seen:
            continue
        seen.add(anomaly.id)
        label = {
            "CONFIRMED_SENSOR_FAULT": True,
            "FALSE_POSITIVE": False,
            "VALID_EXTREME_WEATHER": False,
        }.get(review.operator_classification)
        if label is not None:
            resolved.append((anomaly.classification == "PROBABLE_SENSOR_FAULT", label))
    tp = sum(pred and label for pred, label in resolved)
    fp = sum(pred and not label for pred, label in resolved)
    fn = sum(not pred and label for pred, label in resolved)
    return {
        "reviewed_decisions": len(resolved),
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "precision": tp / (tp + fp) if tp + fp else None,
        "recall": tp / (tp + fn) if tp + fn else None,
        "limitations": [
            "Only reviewed alerts; selection bias prevents estimating population accuracy",
            "Persisted historical decisions, not replayed with the new policy",
        ],
    }


async def main(output: Path, baseline: str):
    try:
        report = {"synthetic": benchmark(baseline), "operator_reviews": await reviewed_decisions()}
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2) + "\n")
        print(json.dumps(report, indent=2))
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("../.local/decision-evaluation.json"))
    parser.add_argument(
        "--baseline",
        default="9d79b2aac1ef94ab552607d5c3c2138b3953561a",
        help="Git commit used for the original decision policy",
    )
    args = parser.parse_args()
    asyncio.run(main(args.output, args.baseline))
