#!/usr/bin/env python
"""Trains, registers, and activates an Isolation Forest per measurement from
real ObservationFeatures rows already in the database.

Registration always produces a CANDIDATE (per app/ml/registry.py — never
auto-activated by training). This script then explicitly activates each
candidate as a deliberate operator action, since there's no admin UI for it
yet; once that UI exists, prefer activating through it instead.

Usage: python scripts/train_models.py [--activate]
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.ml.evaluation import evaluate_candidate  # noqa: E402
from app.ml.registry import ModelRegistry  # noqa: E402
from app.ml.training import train_isolation_forest  # noqa: E402
from app.models.observations import ObservationFeatures  # noqa: E402

FEATURE_NAMES = ["value", "rolling_mean", "rolling_std", "rate_of_change"]
MEASUREMENTS = ["temperature_c", "humidity_pct", "pressure_hpa", "rainfall_mm", "wind_speed_ms", "wind_direction_deg"]
MIN_ROWS = 20


async def main(activate: bool) -> None:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(ObservationFeatures))).scalars().all()
        registry = ModelRegistry(session)

        for measurement in MEASUREMENTS:
            feature_rows = [
                r.features.get(measurement, {}) for r in rows if r.features.get(measurement, {}).get("value") is not None
            ]
            if len(feature_rows) < MIN_ROWS:
                print(f"{measurement}: only {len(feature_rows)} usable rows, need {MIN_ROWS}+, skipping")
                continue

            try:
                trained = train_isolation_forest(feature_rows, FEATURE_NAMES, contamination=0.1)
            except ValueError as exc:
                print(f"{measurement}: training failed — {exc}")
                continue

            metrics = evaluate_candidate(trained, feature_rows)
            model = await registry.register_candidate(
                measurement,
                trained,
                training_start=None,
                training_end=datetime.now(timezone.utc),
                metrics=metrics,
            )
            print(f"{measurement}: registered {model.model_id} v{model.model_version} — {metrics}")

            if activate:
                await registry.activate(model.id)
                print(f"{measurement}: activated")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--activate", action="store_true", help="Activate immediately after registering")
    args = parser.parse_args()
    asyncio.run(main(args.activate))
