"""Adapter registry + the fetch -> raw persist -> validate -> normalize -> dedupe pipeline."""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.metrics import observations_failed_total, observations_ingested_total
from app.ingestion.base import WeatherSourceAdapter
from app.ingestion.era5 import ERA5Adapter
from app.ingestion.gpm import GPMAdapter
from app.ingestion.imd import get_imd_adapter
from app.ingestion.ghcn import GHCNAdapter
from app.ingestion.open_meteo import OpenMeteoAdapter
from app.models.stations import Station
from app.repositories.observation_repository import ObservationRepository

logger = get_logger("meghdrishti.ingestion.manager")


def get_adapter_registry() -> dict[str, WeatherSourceAdapter]:
    return {
        "OPEN_METEO": OpenMeteoAdapter(),
        "IMD": get_imd_adapter(),
        "GHCN": GHCNAdapter(),
        "ERA5": ERA5Adapter(),
        "NASA_GPM": GPMAdapter(),
    }


def payload_hash(source: str, station_code: str, timestamp: str, payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, default=str)
    digest_input = f"{source}|{station_code}|{timestamp}|{canonical}"
    return hashlib.sha256(digest_input.encode()).hexdigest()


class IngestionResult:
    def __init__(self):
        self.fetched = 0
        self.raw_stored = 0
        self.duplicates = 0
        self.schema_invalid = 0
        self.normalized = 0
        self.errors: list[str] = []


async def ingest_station(
    session: AsyncSession,
    station: Station,
    adapter: WeatherSourceAdapter,
    start_time: datetime,
    end_time: datetime,
    ingestion_job_id: uuid.UUID | None = None,
) -> IngestionResult:
    repo = ObservationRepository(session)
    result = IngestionResult()

    try:
        raw_payloads = await adapter.fetch(station, start_time, end_time)
    except Exception as exc:  # noqa: BLE001 - source failures must not crash ingestion
        logger.error("ingestion_fetch_failed", source=adapter.source_name, station=station.station_code, error=str(exc))
        result.errors.append(str(exc))
        return result

    result.fetched = len(raw_payloads)

    for payload in raw_payloads:
        ts_key = payload.get("timestamp") or payload.get("time") or ""
        phash = payload_hash(adapter.source_name, station.station_code, str(ts_key), payload)

        existing = await repo.get_raw_by_hash(phash)
        if existing is not None:
            result.duplicates += 1
            continue

        canonical = None
        schema_valid = True
        try:
            canonical = adapter.normalize(payload)
        except (ValidationError, KeyError, ValueError, TypeError) as exc:
            schema_valid = False
            result.schema_invalid += 1
            logger.warning("ingestion_schema_invalid", source=adapter.source_name, error=str(exc))

        raw = await repo.create_raw(
            source=adapter.source_name,
            station_id=station.id,
            source_timestamp=canonical.timestamp if canonical else None,
            received_at=datetime.now(UTC),
            raw_payload=payload,
            payload_hash=phash,
            ingestion_job_id=ingestion_job_id,
        )
        raw.schema_valid = schema_valid
        result.raw_stored += 1

        if not schema_valid or canonical is None:
            raw.processing_status = "REJECTED"
            observations_failed_total.labels(source=adapter.source_name, reason="schema_invalid").inc()
            continue

        existing_normalized = await repo.get_normalized(station.id, canonical.timestamp, adapter.source_name)
        if existing_normalized is not None:
            raw.processing_status = "PROCESSED"
            result.duplicates += 1
            continue

        measurements = canonical.measurements.model_dump()
        await repo.create_normalized(
            station_id=station.id,
            raw_observation_id=raw.id,
            timestamp=canonical.timestamp,
            source=adapter.source_name,
            measurements=measurements,
            received_at=canonical.received_at,
        )
        raw.processing_status = "NORMALIZED"
        result.normalized += 1
        observations_ingested_total.labels(source=adapter.source_name).inc()

    await session.commit()
    return result
