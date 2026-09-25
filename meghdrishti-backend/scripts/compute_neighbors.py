#!/usr/bin/env python
"""Computes and persists geographic neighbors for every active station.

Run after adding/moving stations. Cheap enough to run on a schedule (see
airflow DAGs) rather than needing to be triggered manually every time.

Usage: python scripts/compute_neighbors.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.context.neighbors import compute_neighbors  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.repositories.station_repository import StationRepository  # noqa: E402


async def main() -> None:
    async with AsyncSessionLocal() as session:
        repo = StationRepository(session)
        stations = await repo.all_active()
        for station in stations:
            neighbors = compute_neighbors(station, stations, k=5, max_km=1500.0)
            await repo.replace_neighbors(station.id, neighbors)
            print(f"{station.station_code}: {len(neighbors)} neighbors")


if __name__ == "__main__":
    asyncio.run(main())
