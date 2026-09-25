"""Geographic neighbor computation. Distances are precomputed by a job, never per-request."""
from __future__ import annotations

import math

from app.models.stations import Station

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def compute_neighbors(station: Station, all_stations: list[Station], k: int = 5, max_km: float = 150.0) -> list[dict]:
    candidates = []
    for other in all_stations:
        if other.id == station.id:
            continue
        distance = haversine_km(station.latitude, station.longitude, other.latitude, other.longitude)
        if distance <= max_km:
            candidates.append((distance, other))

    candidates.sort(key=lambda c: c[0])
    top = candidates[:k]

    return [
        {
            "neighbor_station_id": other.id,
            "distance_km": round(distance, 2),
            "elevation_delta_m": (
                round((other.elevation_m or 0) - (station.elevation_m or 0), 1)
                if other.elevation_m is not None and station.elevation_m is not None
                else None
            ),
            "correlation_score": None,
            "priority": i,
        }
        for i, (distance, other) in enumerate(top)
    ]
