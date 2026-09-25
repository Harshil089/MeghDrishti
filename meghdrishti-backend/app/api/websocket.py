"""FastAPI WebSocket endpoints that relay Redis Pub/Sub events to browsers."""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.logging import get_logger
from app.core.metrics import websocket_connections
from app.db.session import get_redis
from app.services.event_publisher import CHANNEL_ALERTS, CHANNEL_DASHBOARD, channel_for_station

logger = get_logger("meghdrishti.websocket")

router = APIRouter()


async def _relay(websocket: WebSocket, channel: str) -> None:
    await websocket.accept()
    websocket_connections.labels(channel=channel).inc()
    redis = get_redis()
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            await websocket.send_text(message["data"])
    except WebSocketDisconnect:
        pass
    finally:
        websocket_connections.labels(channel=channel).dec()
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()


@router.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    await _relay(websocket, CHANNEL_DASHBOARD)


@router.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    await _relay(websocket, CHANNEL_ALERTS)


@router.websocket("/ws/stations/{station_id}")
async def ws_station(websocket: WebSocket, station_id: str):
    await _relay(websocket, channel_for_station(station_id))
