"""historical_backfill DAG: manually triggered, pulls a wide historical window per station/source.

Not scheduled (schedule=None) — triggered on demand from the Airflow UI/API
with dag_run.conf = {"days": 30, "sources": ["OPEN_METEO"]}.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

from airflow.decorators import dag, task
from airflow.models.param import Param


@dag(
    dag_id="historical_backfill",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    params={"days": Param(30, type="integer"), "sources": Param(["OPEN_METEO"], type="array")},
    tags=["ingestion", "backfill"],
)
def historical_backfill():
    @task
    def backfill(**context) -> dict:
        params = context["params"]
        days = params["days"]
        sources = params["sources"]

        from app.db.session import AsyncSessionLocal
        from app.repositories.station_repository import StationRepository
        from app.services.ingestion_service import IngestionService

        async def _run() -> dict:
            end = datetime.utcnow()
            start = end - timedelta(days=days)
            totals = {"normalized": 0, "duplicates": 0, "errors": 0}
            async with AsyncSessionLocal() as session:
                stations = await StationRepository(session).all_active()
                for station in stations:
                    for source in sources:
                        result = await IngestionService(session).run_for_station(station, source, start, end)
                        totals["normalized"] += result.get("normalized", 0)
                        totals["duplicates"] += result.get("duplicates", 0)
                        totals["errors"] += len(result.get("errors", []))
            return totals

        return asyncio.run(_run())

    backfill()


historical_backfill()
