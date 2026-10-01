"""model_training DAG: weekly trigger for the backend's isolation-forest
candidate training.

The actual training logic lives in the backend (POST /models/train) — same
reason as weather_ingestion.py: Airflow's own Python environment pins
SQLAlchemy 1.4 (required by Airflow 2.10.2 internals) and has no scikit-learn,
while the backend needs SQLAlchemy 2.x async + sklearn. Talking to the
backend over its own HTTP API keeps the two dependency environments fully
separate. Only ever produces CANDIDATE models — activation stays a separate,
human-gated step through the admin/models API.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

import requests
from airflow.decorators import dag, task
from airflow.models import Variable

DEFAULT_ARGS = {
    "owner": "meghdrishti",
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

API_BASE = Variable.get("meghdrishti_api_base", default_var="http://localhost:8000/api/v1")


def _admin_token() -> str:
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
    dag_id="model_training",
    schedule="0 3 * * 0",  # weekly, Sunday 03:00
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=DEFAULT_ARGS,
    tags=["ml"],
)
def model_training():
    @task
    def train_all_measurements() -> list[str]:
        token = _admin_token()
        resp = requests.post(
            f"{API_BASE}/models/train",
            headers={"Authorization": f"Bearer {token}"},
            timeout=300,  # training runs synchronously in-request
        )
        resp.raise_for_status()
        return resp.json()["data"]["candidates"]

    train_all_measurements()


model_training()
