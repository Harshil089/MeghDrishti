"""weather_ingestion DAG: fetch -> store_raw -> schema_validate -> normalize -> deduplicate -> persist -> enqueue_processing.

The heavy lifting (raw persist, schema validation, normalization, dedup) is
already implemented as one pipeline in app.ingestion.manager.ingest_station,
exposed through the backend API — this DAG is a thin HTTP-calling wrapper
around it, run every 15 minutes to match AWS polling cadence.

Deliberately NOT importing anything from app.* here: Airflow's own Python
environment pins SQLAlchemy 1.4 (required by Airflow 2.10.2 internals), while
this backend needs SQLAlchemy 2.x async — the two cannot coexist in one
interpreter. Talking to the backend over its own HTTP API keeps the two
fully separate dependency environments, each pinned to what it actually
needs.
"""
from __future__ import annotations

from datetime import datetime, timedelta

import requests
from airflow.decorators import dag, task
from airflow.models import Variable

DEFAULT_ARGS = {
    "owner": "meghdrishti",
    "retries": 3,
    "retry_delay": timedelta(minutes=2),
}

API_BASE = Variable.get("meghdrishti_api_base", default_var="http://api:8000/api/v1")
INGEST_SOURCES = ["OPEN_METEO", "IMD"]


def _admin_token() -> str:
    """Log in as the demo admin — same credentials the backend seeds itself
    with (DEMO_ADMIN_EMAIL/PASSWORD), already available via this container's
    env_file. Not a new auth mechanism, just reusing the existing one."""
    import os

    resp = requests.post(
        f"{API_BASE}/auth/login",
        data={
            "username": os.environ["DEMO_ADMIN_EMAIL"],
            "password": os.environ["DEMO_ADMIN_PASSWORD"],
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


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
        token = _admin_token()
        headers = {"Authorization": f"Bearer {token}"}

        stations = requests.get(
            f"{API_BASE}/stations", params={"limit": 500, "is_active": "true"}, headers=headers, timeout=15
        ).json()["data"]
        job_ids: list[str] = []
        for station in stations:
            for source in INGEST_SOURCES:
                resp = requests.post(
                    f"{API_BASE}/admin/ingest/{station['id']}",
                    params={"source": source, "window_minutes": 20},
                    headers=headers,
                    timeout=30,
                )
                if resp.status_code != 200:
                    continue  # one bad station/source shouldn't fail the whole run
                job_ids.append(resp.json()["data"]["job_id"])
        return job_ids

    @task
    def enqueue_processing(job_ids: list[str]) -> None:
        """Hand normalized observations from this run to the realtime Celery pipeline."""
        if not job_ids:
            return
        token = _admin_token()
        requests.post(
            f"{API_BASE}/admin/enqueue-processing",
            json={"job_ids": job_ids},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )

    enqueue_processing(fetch_and_persist_all_stations())


weather_ingestion()
