"""ghcn_stations DAG: refresh the India-only GHCNh station roster cache.

NOAA's master station list changes rarely (new/decommissioned stations),
so a daily pull is plenty — this isn't a data feed, it's reference metadata
GHCNAdapter uses to resolve the nearest GHCN station to an AWS station.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from airflow.decorators import dag, task
from backend_api import API_BASE, backend_session

DEFAULT_ARGS = {
    "owner": "meghdrishti",
    "retries": 3,
    "retry_delay": timedelta(minutes=5),
}


@dag(
    dag_id="ghcn_stations",
    schedule="0 3 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=DEFAULT_ARGS,
    tags=["ingestion", "reference-data"],
)
def ghcn_stations():
    @task
    def refresh() -> int:
        with backend_session() as session:
            response = session.post(f"{API_BASE}/admin/ghcn-stations/refresh", timeout=60)
            response.raise_for_status()
            return response.json()["data"]["stations"]

    refresh()


ghcn_stations()
