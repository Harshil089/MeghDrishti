"""Lightweight native scheduling through the same API boundary as Airflow."""
from __future__ import annotations

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.workers.celery_app import celery_app

logger = get_logger("meghdrishti.workers.schedule")


@celery_app.task(name="app.workers.schedule_tasks.run_scheduled_job")
def run_scheduled_job(operation: str, window_minutes: int = 20,
                      sources: list[str] | None = None) -> dict:
    endpoints = {
        "train": "/models/train",
        "calibrate": "/admin/calibration/propose",
        "roster": "/admin/ghcn-stations/refresh",
    }
    if operation not in {"ingest", *endpoints}:
        raise ValueError(f"Unknown scheduled operation: {operation}")
    if not 1 <= window_minutes <= 525600:
        raise ValueError("window_minutes must be between 1 and 525600")
    if sources is None:
        sources = ["OPEN_METEO"]
        if settings.imd_enabled and settings.imd_api_base_url and settings.imd_api_key:
            sources.append("IMD")
    with httpx.Client(base_url=f"http://127.0.0.1:8000{settings.api_v1_prefix}",
                      timeout=300) as client:
        login = client.post("/auth/login", data={
            "username": settings.demo_admin_email,
            "password": settings.demo_admin_password,
        })
        login.raise_for_status()
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
        if operation in endpoints:
            response = client.post(endpoints[operation])
            response.raise_for_status()
            return response.json()
        jobs, errors, offset = [], [], 0
        while True:
            response = client.get("/stations", params={
                "is_active": "true", "limit": 500, "offset": offset,
            })
            response.raise_for_status()
            stations = response.json()["data"]
            for station in stations:
                for source in sources:
                    try:
                        response = client.post(f"/admin/ingest/{station['id']}", params={
                            "source": source, "window_minutes": window_minutes,
                        })
                        response.raise_for_status()
                        stats = response.json()["data"]
                        if stats.get("errors"):
                            errors.append(f"{station['id']}/{source}: {stats['errors']}")
                            if stats.get("raw_stored", 0) == 0:
                                continue
                        jobs.append(stats["job_id"])
                    except httpx.HTTPError as exc:
                        errors.append(f"{station['id']}/{source}: {exc}")
            if len(stations) < 500:
                break
            offset += len(stations)
        if jobs:
            response = client.post("/admin/enqueue-processing", json={"job_ids": jobs})
            response.raise_for_status()
        if errors:
            logger.error("scheduled_ingestion_partial_failure", errors=errors)
            raise RuntimeError(f"{len(errors)} station/source requests failed; successful jobs enqueued")
        return {"job_ids": jobs}
