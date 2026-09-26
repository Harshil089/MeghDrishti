"""India station roster for GHCN-hourly (NOAA GHCNh), refreshed periodically
from the master station list — not fetched per-request. Cached to disk;
refresh cadence is owned by the ghcn_stations Airflow DAG, not this module.
"""
from __future__ import annotations

import json
from pathlib import Path

import httpx

STATION_LIST_URL = (
    "https://www.ncei.noaa.gov/oa/global-historical-climatology-network/"
    "hourly/doc/ghcnh-station-list.txt"
)
CACHE_PATH = Path(__file__).resolve().parents[2] / "var" / "ghcn_india_stations.json"


def _parse_line(line: str) -> dict | None:
    parts = line.split()
    if len(parts) < 4 or parts[-1] != "IN":
        return None
    try:
        return {
            "station_id": parts[0],
            "latitude": float(parts[1]),
            "longitude": float(parts[2]),
            "elevation_m": float(parts[3]),
            "name": " ".join(parts[4:-1]),
        }
    except ValueError:
        return None


async def refresh_india_stations() -> int:
    """Pull the master GHCNh station list, keep India-only rows, write cache. Returns row count."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(STATION_LIST_URL)
        resp.raise_for_status()
        text = resp.text
    stations = [s for line in text.splitlines() if (s := _parse_line(line))]
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(stations))
    return len(stations)


def load_india_stations() -> list[dict]:
    if not CACHE_PATH.exists():
        return []
    return json.loads(CACHE_PATH.read_text())


def nearest_station(lat: float, lon: float) -> dict | None:
    """ponytail: flat-earth nearest neighbor (no haversine), fine at ~586 rows/India-scale distances."""
    stations = load_india_stations()
    if not stations:
        return None
    return min(stations, key=lambda s: (s["latitude"] - lat) ** 2 + (s["longitude"] - lon) ** 2)
