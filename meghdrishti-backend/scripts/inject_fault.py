#!/usr/bin/env python
"""Synthetic fault generator for demos/tests where labelled sensor failures are scarce.

Injects a chosen fault type into a station's most recent observation window,
then optionally runs the realtime pipeline against them so the anomaly
system's response can be inspected end-to-end.

Usage:
    python scripts/inject_fault.py --station PUNE001 --type spike --measurement temperature_c
    python scripts/inject_fault.py --station PUNE001 --type stuck --measurement humidity_pct --process
"""
from __future__ import annotations

import argparse
import asyncio
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.observations import WeatherObservation  # noqa: E402
from app.repositories.station_repository import StationRepository  # noqa: E402

FAULT_TYPES = ["stuck", "spike", "drift", "dropout", "telemetry_gap", "physical_impossibility"]

PHYSICAL_LIMITS = {
    "temperature_c": 85.0,
    "humidity_pct": 150.0,
    "pressure_hpa": 1300.0,
    "rainfall_mm": -5.0,
    "wind_speed_ms": 200.0,
    "wind_direction_deg": 720.0,
}


async def inject(station_code: str, fault_type: str, measurement: str, count: int) -> list[str]:
    async with AsyncSessionLocal() as session:
        repo = StationRepository(session)
        station = await repo.get_by_code(station_code)
        if station is None:
            raise SystemExit(f"Station {station_code} not found — seed it first (python -m app.db.seed)")

        now = datetime.now(timezone.utc)
        rng = random.Random(0)
        base_value = {"temperature_c": 24.0, "humidity_pct": 65.0, "pressure_hpa": 1008.0,
                      "rainfall_mm": 0.0, "wind_speed_ms": 3.0, "wind_direction_deg": 180.0}[measurement]

        created_objs: list[WeatherObservation] = []

        def new_obs(ts: datetime, value: float | None) -> WeatherObservation:
            defaults = {"temperature_c": 24.0, "humidity_pct": 65.0, "pressure_hpa": 1008.0,
                        "rainfall_mm": 0.0, "wind_speed_ms": 3.0, "wind_direction_deg": 180.0}
            defaults[measurement] = value
            return WeatherObservation(
                station_id=station.id, timestamp=ts, source="SYNTHETIC_FAULT_INJECTOR",
                received_at=ts, **defaults,
            )

        # Seed some normal history first so rules have a baseline.
        for i in range(15, 0, -1):
            ts = now - timedelta(minutes=15 * i)
            session.add(new_obs(ts, base_value + rng.uniform(-0.5, 0.5)))

        if fault_type == "stuck":
            stuck_value = base_value + 3.0
            for i in range(count):
                ts = now - timedelta(minutes=15 * (count - i))
                obs = new_obs(ts, stuck_value)
                session.add(obs)
                created_objs.append(obs)

        elif fault_type == "spike":
            obs = new_obs(now, base_value * 2.5 + 20)
            session.add(obs)
            created_objs.append(obs)

        elif fault_type == "drift":
            for i in range(count, 0, -1):
                ts = now - timedelta(hours=i)
                obs = new_obs(ts, base_value + (count - i) * 2.0)
                session.add(obs)
                created_objs.append(obs)

        elif fault_type == "dropout":
            obs = new_obs(now, None)
            session.add(obs)
            created_objs.append(obs)

        elif fault_type == "telemetry_gap":
            obs = new_obs(now, base_value)  # gap is implied by the 3h jump from seeded history above
            session.add(new_obs(now - timedelta(hours=3), None))
            session.add(obs)
            created_objs.append(obs)

        elif fault_type == "physical_impossibility":
            obs = new_obs(now, PHYSICAL_LIMITS[measurement])
            session.add(obs)
            created_objs.append(obs)

        else:
            raise SystemExit(f"Unknown fault type: {fault_type}")

        await session.commit()
        return [str(o.id) for o in created_objs]


async def process(observation_ids: list[str]) -> None:
    from app.workers.pipeline import process_observation

    for obs_id in observation_ids:
        anomaly_id = await process_observation(uuid.UUID(obs_id))
        print(f"observation {obs_id} -> anomaly {anomaly_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--station", required=True)
    parser.add_argument("--type", required=True, choices=FAULT_TYPES)
    parser.add_argument("--measurement", default="temperature_c")
    parser.add_argument("--count", type=int, default=12, help="Consecutive readings for stuck/drift faults")
    parser.add_argument("--process", action="store_true", help="Also run the realtime pipeline against injected observations")
    args = parser.parse_args()

    async def _main():
        ids = await inject(args.station, args.type, args.measurement, args.count)
        print(f"Injected {len(ids)} '{args.type}' observation(s) for {args.station}/{args.measurement}: {ids}")
        if args.process:
            await process(ids)

    asyncio.run(_main())


if __name__ == "__main__":
    main()
