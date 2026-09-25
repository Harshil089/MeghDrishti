"""Publishes realtime events to Redis Pub/Sub; FastAPI WebSocket endpoints relay them to browsers."""
from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from app.db.session import get_redis

CHANNEL_DASHBOARD = "ws:dashboard"
CHANNEL_ALERTS = "ws:alerts"


def channel_for_station(station_id: str) -> str:
    return f"ws:station:{station_id}"


async def publish_event(channel: str, event_type: str, payload: dict[str, Any]) -> None:
    message = json.dumps(
        {"event_type": event_type, "timestamp": datetime.now(UTC).isoformat(), "payload": payload}
    )
    redis = get_redis()
    await redis.publish(channel, message)


async def publish_dashboard_event(event_type: str, payload: dict) -> None:
    await publish_event(CHANNEL_DASHBOARD, event_type, payload)


async def publish_alert_event(event_type: str, payload: dict) -> None:
    await publish_event(CHANNEL_ALERTS, event_type, payload)


async def publish_station_event(station_id: str, event_type: str, payload: dict) -> None:
    await publish_event(channel_for_station(station_id), event_type, payload)
