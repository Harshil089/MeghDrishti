"""Celery application: near-real-time observation processing, off the request path."""
from __future__ import annotations

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "meghdrishti",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.workers.qc_tasks",
        "app.workers.context_tasks",
        "app.workers.alert_tasks",
        "app.workers.health_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.qc_tasks.*": {"queue": "qc"},
        "app.workers.context_tasks.*": {"queue": "context"},
        "app.workers.alert_tasks.*": {"queue": "alert"},
        "app.workers.health_tasks.*": {"queue": "health"},
    },
)
