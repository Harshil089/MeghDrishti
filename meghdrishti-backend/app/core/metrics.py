"""Custom Prometheus metrics. HTTP request/latency metrics come from
prometheus-fastapi-instrumentator (wired in main.py) — these cover the
domain-specific pipeline signals it can't see.
"""
from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

observations_ingested_total = Counter(
    "meghdrishti_observations_ingested_total", "Observations successfully normalized", ["source"]
)
observations_failed_total = Counter(
    "meghdrishti_observations_failed_total", "Observations rejected or failed during ingestion", ["source", "reason"]
)
source_api_latency_seconds = Histogram(
    "meghdrishti_source_api_latency_seconds", "External weather source API latency", ["source"]
)
source_api_errors_total = Counter(
    "meghdrishti_source_api_errors_total", "External weather source API errors", ["source"]
)

rules_triggered_total = Counter("meghdrishti_rules_triggered_total", "QC rule triggers", ["rule"])
processing_latency_seconds = Histogram(
    "meghdrishti_processing_latency_seconds", "End-to-end observation processing latency", ["stage"]
)

anomalies_created_total = Counter(
    "meghdrishti_anomalies_created_total", "Anomalies created", ["classification"]
)
alerts_created_total = Counter("meghdrishti_alerts_created_total", "Alerts created", ["priority", "policy"])
classification_counts = Counter("meghdrishti_classification_total", "Anomaly classification counts", ["classification"])

station_health_distribution = Gauge(
    "meghdrishti_station_health_distribution", "Station count by health status", ["status"]
)

model_inference_duration_seconds = Histogram(
    "meghdrishti_model_inference_duration_seconds", "Isolation Forest inference duration", ["measurement"]
)
context_fetch_duration_seconds = Histogram(
    "meghdrishti_context_fetch_duration_seconds", "Context provider fetch duration", ["provider"]
)
context_provider_availability = Gauge(
    "meghdrishti_context_provider_availability", "1 if provider responded, 0 otherwise", ["provider"]
)

websocket_connections = Gauge("meghdrishti_websocket_connections", "Active WebSocket connections", ["channel"])

celery_queue_depth = Gauge("meghdrishti_celery_queue_depth", "Approximate Celery queue depth", ["queue"])
