"""One candidate-training policy for API, CLI and scheduled jobs.

Forecast data can support diagnostics, but cannot validate sensor-fault accuracy.
All evaluation uses later timestamps, never the rows fitted by the estimator.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from math import isfinite

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.builder import MEASUREMENTS, FeatureBuilder, FeatureInputs
from app.ml.evaluation import evaluate_candidate
from app.ml.registry import ModelRegistry
from app.ml.training import build_feature_matrix, train_isolation_forest
from app.models.anomalies import Anomaly
from app.models.ingestion import RawObservation
from app.models.observations import WeatherObservation
from app.models.reviews import OperatorReview

TRAIN_MEASUREMENTS = ["temperature_c", "humidity_pct", "pressure_hpa", "wind_speed_ms"]
TRAIN_FEATURE_NAMES = ["value", "delta_1h", "rolling_std", "rate_of_change"]
SENSOR_SOURCES = {"IMD", "GHCN"}
MIN_TRAIN_ROWS = 20
MIN_HOLDOUT_ROWS = 10


async def train_candidates(db: AsyncSession) -> dict:
    now = datetime.now(UTC)
    since = now - timedelta(days=90)
    reviews = await db.execute(
        select(Anomaly.observation_id, Anomaly.measurement, OperatorReview.operator_classification)
        .join(OperatorReview, OperatorReview.anomaly_id == Anomaly.id)
        .order_by(OperatorReview.created_at.desc(), OperatorReview.id)
    )
    labels = {}
    for observation_id, measurement, classification in reviews.all():
        labels.setdefault(
            (observation_id, measurement),
            {
                "CONFIRMED_SENSOR_FAULT": True,
                "VALID_EXTREME_WEATHER": False,
                "FALSE_POSITIVE": False,
            }.get(classification),
        )
    result = await db.execute(
        select(WeatherObservation, RawObservation.raw_payload)
        .outerjoin(RawObservation, RawObservation.id == WeatherObservation.raw_observation_id)
        .where(
            WeatherObservation.timestamp >= since,
            WeatherObservation.timestamp <= now,
            WeatherObservation.source.in_(SENSOR_SOURCES | {"OPEN_METEO"}),
        )
        .order_by(
            WeatherObservation.timestamp,
            WeatherObservation.received_at.desc(),
            WeatherObservation.id,
        )
    )
    # Rebuild causal features: old stored features may mix demo and provider histories.
    history = defaultdict(list)
    samples = defaultdict(list)
    seen = set()
    builder = FeatureBuilder()
    for obs, payload in result.all():
        key = (obs.station_id, obs.source)
        event = (*key, obs.timestamp)
        if event in seen:
            continue  # one reading per station/source/time; newest received version wins
        seen.add(event)
        values = {name: getattr(obs, name) for name in MEASUREMENTS}
        values = {
            name: value if value is not None and isfinite(value) else None
            for name, value in values.items()
        }
        if obs.source == "OPEN_METEO" and (payload or {}).get("wind_speed_unit") != "m/s":
            # The old adapter stored km/h in an m/s column. Never use those values,
            # including as historical inputs to a newer, correctly labelled reading.
            values["wind_speed_ms"] = None
        features, _ = builder.build(
            FeatureInputs(
                timestamp=obs.timestamp, measurements=values, history=history[key][-100:][::-1]
            )
        )
        history[key].append({"timestamp": obs.timestamp, **values})
        for measurement in TRAIN_MEASUREMENTS:
            row = features[measurement]
            if len(build_feature_matrix([row], TRAIN_FEATURE_NAMES)):
                samples[measurement].append((obs, row))

    candidates, skipped = [], {}
    registry = ModelRegistry(db)
    for measurement in TRAIN_MEASUREMENTS:
        rows = samples[measurement]
        timestamps = sorted({obs.timestamp for obs, _ in rows})
        if len(timestamps) < 2:
            skipped[measurement] = (
                "Not enough distinct observation times for a chronological holdout"
            )
            continue
        boundary = timestamps[min(len(timestamps) - 1, int(len(timestamps) * 0.8))]
        training = [(obs, row) for obs, row in rows if obs.timestamp < boundary]
        training = [
            (obs, row) for obs, row in training if labels.get((obs.id, measurement)) is not True
        ]
        holdout = [(obs, row) for obs, row in rows if obs.timestamp >= boundary]
        if len(training) < MIN_TRAIN_ROWS or len(holdout) < MIN_HOLDOUT_ROWS:
            skipped[measurement] = (
                f"Usable train/holdout rows {len(training)}/{len(holdout)}; "
                f"need {MIN_TRAIN_ROWS}/{MIN_HOLDOUT_ROWS}"
            )
            continue
        trained = train_isolation_forest([row for _, row in training], TRAIN_FEATURE_NAMES)
        metrics = evaluate_candidate(
            trained,
            [row for _, row in holdout],
            [labels.get((obs.id, measurement)) for obs, _ in holdout],
        )
        sources = dict(Counter(obs.source for obs, _ in training))
        # Store the exact immutable feature inputs in metrics, alongside observation IDs.
        # A hash alone would not reproduce a run after observations were corrected.
        manifest = {
            name: [
                {
                    "observation_id": str(obs.id),
                    "timestamp": obs.timestamp.isoformat(),
                    "station_id": str(obs.station_id),
                    "source": obs.source,
                    "features": {f: row[f] for f in TRAIN_FEATURE_NAMES},
                }
                for obs, row in partition
            ]
            for name, partition in [("train", training), ("holdout", holdout)]
        }
        metrics.update(
            {
                "evaluation_method": "chronological_holdout",
                "training_policy_version": 2,
                "training_samples": len(training),
                "training_distinct_timestamps": len({obs.timestamp for obs, _ in training}),
                "holdout_distinct_timestamps": len({obs.timestamp for obs, _ in holdout}),
                "training_sources": sources,
                "holdout_sources": dict(Counter(obs.source for obs, _ in holdout)),
                "holdout_start": boundary.isoformat(),
                "holdout_end": holdout[-1][0].timestamp.isoformat(),
                "limitations": ["Anomaly score is not a calibrated fault probability"],
                "sensor_data_only": set(sources) <= SENSOR_SOURCES,
                "dataset_manifest": manifest,
                "dataset_sha256": sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest(),
            }
        )
        if not metrics["labelled_samples"]:
            metrics["limitations"].append(
                "No independent holdout fault labels; accuracy is unknown"
            )
        if not metrics["sensor_data_only"]:
            metrics["limitations"].append(
                "Forecast-model outputs included; diagnostic candidate only"
            )
        model = await registry.register_candidate(
            measurement,
            trained,
            training_start=training[0][0].timestamp,
            training_end=training[-1][0].timestamp,
            metrics=metrics,
        )
        candidates.append(str(model.id))
    return {"candidates": candidates, "skipped": skipped}
