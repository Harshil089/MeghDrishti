"""calibration DAG: aggregate_operator_labels -> calculate_metrics -> propose_thresholds -> save_candidate_profile.

Saves a new inactive CalibrationProfile row for review — it never flips
is_active itself, matching "operator feedback must not instantly retrain
production models/thresholds".
"""
from __future__ import annotations

from datetime import datetime

from airflow.decorators import dag, task
from backend_api import API_BASE, backend_session


@dag(
    dag_id="calibration",
    schedule="0 4 * * 1",  # weekly, Monday 04:00
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["ml", "calibration"],
)
def calibration():
    @task
    def aggregate_and_propose() -> dict:
        with backend_session() as session:
            response = session.post(f"{API_BASE}/admin/calibration/propose", timeout=30)
            response.raise_for_status()
            return response.json()["data"]

    aggregate_and_propose()


calibration()
