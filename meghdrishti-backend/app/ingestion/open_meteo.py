"""Open-Meteo adapter — no API key required, easiest source for end-to-end testing."""
from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import get_logger
from app.ingestion.base import WeatherSourceAdapter
from app.schemas.observation import CanonicalObservation, Location, Measurements

logger = get_logger("meghdrishti.ingestion.open_meteo")

_HOURLY_VARS = "temperature_2m,relative_humidity_2m,surface_pressure,precipitation,wind_speed_10m,wind_direction_10m"


class OpenMeteoAdapter(WeatherSourceAdapter):
    source_name = "OPEN_METEO"

    def __init__(self, base_url: str | None = None, client: httpx.AsyncClient | None = None):
        self.base_url = base_url or settings.open_meteo_base_url
        self._client = client

    def _http(self) -> httpx.AsyncClient:
        return self._client or httpx.AsyncClient(timeout=10.0)

    @retry(
        reraise=True,
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        retry=retry_if_exception_type((httpx.TransportError, httpx.HTTPStatusError)),
    )
    async def fetch(self, station: Any, start_time: datetime, end_time: datetime) -> list[dict]:
        params = {
            "latitude": station.latitude,
            "longitude": station.longitude,
            "hourly": _HOURLY_VARS,
            "start_date": start_time.date().isoformat(),
            "end_date": end_time.date().isoformat(),
            "timezone": "UTC",
        }
        client = self._http()
        try:
            resp = await client.get(f"{self.base_url}/forecast", params=params)
            resp.raise_for_status()
            data = resp.json()
        finally:
            if self._client is None:
                await client.aclose()

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        naive_start, naive_end = start_time.replace(tzinfo=None), end_time.replace(tzinfo=None)
        records = []
        for i, t in enumerate(times):
            # /forecast always returns the full requested day(s), including
            # hours after "now" — without this filter every ingestion run on
            # the same day re-fetches an identical payload (dedup'd as
            # duplicates), so nothing after the first run ever looks new.
            if not (naive_start <= datetime.fromisoformat(t) <= naive_end):
                continue
            records.append(
                {
                    "station_id": station.station_code,
                    "latitude": station.latitude,
                    "longitude": station.longitude,
                    "elevation_m": getattr(station, "elevation_m", None),
                    "time": t,
                    "temperature_2m": _at(hourly.get("temperature_2m"), i),
                    "relative_humidity_2m": _at(hourly.get("relative_humidity_2m"), i),
                    "surface_pressure": _at(hourly.get("surface_pressure"), i),
                    "precipitation": _at(hourly.get("precipitation"), i),
                    "wind_speed_10m": _at(hourly.get("wind_speed_10m"), i),
                    "wind_direction_10m": _at(hourly.get("wind_direction_10m"), i),
                }
            )
        return records

    def normalize(self, payload: dict) -> CanonicalObservation:
        return CanonicalObservation(
            station_id=payload["station_id"],
            timestamp=datetime.fromisoformat(payload["time"]),
            location=Location(
                latitude=payload["latitude"],
                longitude=payload["longitude"],
                elevation_m=payload.get("elevation_m"),
            ),
            measurements=Measurements(
                temperature_c=payload.get("temperature_2m"),
                humidity_pct=payload.get("relative_humidity_2m"),
                pressure_hpa=payload.get("surface_pressure"),
                rainfall_mm=payload.get("precipitation"),
                wind_speed_ms=payload.get("wind_speed_10m"),
                wind_direction_deg=payload.get("wind_direction_10m"),
            ),
            source=self.source_name,
        )

    async def health_check(self) -> bool:
        try:
            client = self._http()
            try:
                resp = await client.get(
                    f"{self.base_url}/forecast",
                    params={"latitude": 0, "longitude": 0, "hourly": "temperature_2m", "forecast_days": 1},
                )
                return resp.status_code == 200
            finally:
                if self._client is None:
                    await client.aclose()
        except httpx.TransportError:
            return False


def _at(arr: list | None, i: int):
    if arr is None or i >= len(arr):
        return None
    return arr[i]
