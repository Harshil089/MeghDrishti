"""Link every IMD AWS station to its nearest IMD AWS stations (up to 5 within 50 km).

The pipeline compares a reading with these neighbours' latest IMD readings, which
is the main independent context for bulk-imported AWS stations. Re-run after
importing stations. Run: .venv/bin/python scripts/build_imd_neighbors.py
"""
from __future__ import annotations

import asyncio
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.stations import Station, StationNeighbor  # noqa: E402

MAX_KM, MAX_NEIGHBORS = 50.0, 5


def _km(a: Station, b: Station) -> float:
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    dlat, dlon = lat2 - lat1, math.radians(b.longitude - a.longitude)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


async def main() -> None:
    async with AsyncSessionLocal() as session:
        stations = list((await session.execute(select(Station).where(Station.source == "IMD_AWS"))).scalars())
        ids = [s.id for s in stations]
        await session.execute(delete(StationNeighbor).where(StationNeighbor.station_id.in_(ids)))
        # 1-degree buckets keep this O(n) instead of comparing all ~9.6M pairs.
        grid: dict[tuple[int, int], list[Station]] = {}
        for s in stations:
            grid.setdefault((math.floor(s.latitude), math.floor(s.longitude)), []).append(s)
        links = with_any = 0
        for s in stations:
            gy, gx = math.floor(s.latitude), math.floor(s.longitude)
            nearby = [o for dy in (-1, 0, 1) for dx in (-1, 0, 1) for o in grid.get((gy + dy, gx + dx), []) if o.id != s.id]
            ranked = sorted(((d, o) for o in nearby if (d := _km(s, o)) <= MAX_KM), key=lambda pair: pair[0])[:MAX_NEIGHBORS]
            for priority, (d, o) in enumerate(ranked):
                elev = (s.elevation_m - o.elevation_m) if s.elevation_m is not None and o.elevation_m is not None else None
                session.add(StationNeighbor(station_id=s.id, neighbor_station_id=o.id, distance_km=round(d, 2),
                                            elevation_delta_m=elev, priority=priority))
            links += len(ranked)
            with_any += bool(ranked)
        await session.commit()
    print(f"{len(stations)} IMD stations: {with_any} have neighbours, {links} links (<= {MAX_NEIGHBORS} within {MAX_KM:.0f} km)")


if __name__ == "__main__":
    asyncio.run(main())
