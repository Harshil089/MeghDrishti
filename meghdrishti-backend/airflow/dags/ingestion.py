"""weather_ingestion DAG: fetch -> store_raw -> schema_validate -> normalize -> deduplicate -> persist -> enqueue_processing.

The heavy lifting (raw persist, schema validation, normalization, dedup) is
already implemented as one pipeline in app.ingestion.manager.ingest_station —
this DAG is a thin scheduling wrapper around it plus the follow-on realtime
processing enqueue, run every 15 minutes to match AWS polling cadence.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from airflow.decorators import dag, task

DEFAULT_ARGS = {
    "owner": "meghdrishti",
    "retries": 3,
    "retry_delay": timedelta(minutes=2),
}


@dag(
    dag_id="weather_ingestion",
    schedule="*/15 * * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=DEFAULT_ARGS,
    tags=["ingestion"],
)
def weather_ingestion():
    @task
    def fetch_and_persist_all_stations() -> list[str]:
        """fetch_source -> store_raw -> schema_validate -> normalize -> deduplicate -> persist, per active station/source."""
        from app.db.session import AsyncSessionLocal
        from app.repositories.station_repository import StationRepository
        from app.services.ingestion_service import IngestionService

        async def _run() -> list[str]:
            job_ids: list[str] = []
            end = datetime.utcnow()
            start = end - timedelta(minutes=20)
            async with AsyncSessionLocal() as session:
                stations = await StationRepository(session).all_active()
                for station in stations:
                    for source in ["OPEN_METEO", "IMD"]:
                        result = await IngestionService(session).run_for_station(station, source, start, end)
                        job_ids.append(result["job_id"])
            return job_ids

        return asyncio.run(_run())

    @task
    def enqueue_processing(job_ids: list[str]) -> None:
        """Hand normalized observations from this run to the realtime Celery pipeline."""
        from app.db.session import AsyncSessionLocal
        from sqlalchemy import select
        from app.models.ingestion import RawObservation
        from app.models.observations import WeatherObservation
        from app.workers.qc_tasks import process_observation_task

        async def _run():
            async with AsyncSessionLocal() as session:
                import uuid as _uuid

                job_uuids = [_uuid.UUID(j) for j in job_ids]
                result = await session.execute(
                    select(WeatherObservation.id)
                    .join(RawObservation, RawObservation.id == WeatherObservation.raw_observation_id)
                    .where(RawObservation.ingestion_job_id.in_(job_uuids))
                )
                for (observation_id,) in result.all():
                    process_observation_task.delay(str(observation_id))

        asyncio.run(_run())

    enqueue_processing(fetch_and_persist_all_stations())


weather_ingestion()
