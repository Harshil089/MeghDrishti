"""historical_backfill DAG: manually triggered, pulls a wide historical window per station/source.

Not scheduled (schedule=None) — triggered on demand from the Airflow UI/API
with dag_run.conf = {"days": 30, "sources": ["OPEN_METEO"]}.
"""
from __future__ import annotations

from datetime import datetime

from airflow.decorators import dag, task
from airflow.models.param import Param
from backend_api import API_BASE, backend_session


@dag(
    dag_id="historical_backfill",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    params={"days": Param(30, type="integer", minimum=1, maximum=365), "sources": Param(["OPEN_METEO"], type="array")},
    tags=["ingestion", "backfill"],
)
def historical_backfill():
    @task
    def backfill(**context) -> dict:
        params = context["params"]
        days = params["days"]
        sources = params["sources"]

        totals = {"normalized": 0, "duplicates": 0, "errors": 0}
        with backend_session() as session:
            offset = 0
            while True:
                response = session.get(f"{API_BASE}/stations", params={"is_active": "true", "limit": 500, "offset": offset}, timeout=30)
                response.raise_for_status()
                stations = response.json()["data"]
                if not stations:
                    break
                for station in stations:
                    for source in sources:
                        response = session.post(f"{API_BASE}/admin/ingest/{station['id']}", params={"source": source, "window_minutes": days * 1440}, timeout=300)
                        response.raise_for_status()
                        result = response.json()["data"]
                        totals["normalized"] += result.get("normalized", 0)
                        totals["duplicates"] += result.get("duplicates", 0)
                        totals["errors"] += len(result.get("errors", []))
                offset += len(stations)
        return totals

    backfill()


historical_backfill()
