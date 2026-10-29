"""Add every AWS in IMD's aws_data_mapping to the stations table (idempotent).

New stations get source IMD_AWS, so the scheduler ingests them only from IMD
(never Open-Meteo), and only once IMD_ENABLED=true.

Run: .venv/bin/python scripts/import_imd_stations.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.db.seed import MEASUREMENTS, UNITS  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.ingestion.imd import coord, imd_get  # noqa: E402
from app.models.stations import Station, StationSensor  # noqa: E402

SOURCE = "IMD_AWS"


def _label(raw: str | None) -> str:
    return (raw or "").replace("_", " ").strip().title()


async def main() -> None:
    rows = imd_get("aws_data_mapping")["data"]
    async with AsyncSessionLocal() as session:
        existing = set((await session.execute(select(Station.station_code))).scalars())
        added = skipped = 0
        for row in rows:
            code = f"IMD_AWS_{row['ID']}"
            lat, lon = coord(row.get("Latitude")), coord(row.get("Longitude"))
            if code in existing or lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
                skipped += 1
                continue
            existing.add(code)
            name = _label(row.get("STATION"))
            district = _label(row.get("DISTRICT"))
            station = Station(
                station_code=code,
                name=f"{name}, {district}" if district and district != name else name,
                source=SOURCE,
                latitude=lat,
                longitude=lon,
                region=(row.get("STATE") or "").strip().upper() or None,
                is_active=True,
            )
            session.add(station)
            await session.flush()
            for m in MEASUREMENTS:
                session.add(StationSensor(station_id=station.id, measurement=m, unit=UNITS[m], is_active=True))
            added += 1
        await session.commit()
    print(f"IMD AWS stations: {len(rows)} listed, {added} added, {skipped} skipped (existing or bad coordinates)")


if __name__ == "__main__":
    asyncio.run(main())
