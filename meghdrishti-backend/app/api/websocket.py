"""FastAPI WebSocket endpoints that relay Redis Pub/Sub events to browsers."""
from __future__ import annotations

import time
import uuid

import anyio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.logging import get_logger
from app.core.metrics import websocket_connections
from app.core.security import decode_token
from app.db.session import AsyncSessionLocal, get_redis
from app.repositories.user_repository import UserRepository
from app.services.event_publisher import CHANNEL_ALERTS, CHANNEL_DASHBOARD, channel_for_station

logger = get_logger("meghdrishti.websocket")

router = APIRouter()


# Socket lifetime is bounded by the token: re-check the account and token expiry
# on this interval, so deactivation or expiry closes open sockets.
RECHECK_SECONDS = 60


async def _authenticate(websocket: WebSocket) -> dict | None:
    """Browsers can't set an Authorization header on a WS handshake, so the
    access token travels as a query param instead — same JWT the REST API
    uses, just relocated."""
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="missing token")
        return None
    try:
        payload = decode_token(token)
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="invalid token")
        return None
    if payload.get("type") != "access":
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="invalid token type")
        return None
    return payload


async def _recheck(websocket: WebSocket, payload: dict, scope: anyio.CancelScope) -> None:
    """Close the socket when the token expires or the account goes inactive."""
    while True:
        await anyio.sleep(RECHECK_SECONDS)
        if payload["exp"] <= time.time():
            reason = "token expired"
        else:
            async with AsyncSessionLocal() as db:
                user = await UserRepository(db).get_by_id(payload["sub"])
            if user is not None and user.is_active:
                continue
            reason = "user inactive"
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=reason)
        scope.cancel()
        return


async def _relay(websocket: WebSocket, channel: str) -> None:
    payload = await _authenticate(websocket)
    if payload is None:
        return
    await websocket.accept()
    websocket_connections.labels(channel=channel).inc()
    redis = get_redis()
    pubsub = redis.pubsub()

    async def forward_events():
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])

    async def wait_for_disconnect():
        while (await websocket.receive())["type"] != "websocket.disconnect":
            pass

    try:
        await pubsub.subscribe(channel)
        async with anyio.create_task_group() as group:
            group.start_soon(forward_events)
            group.start_soon(_recheck, websocket, payload, group.cancel_scope)
            await wait_for_disconnect()
            group.cancel_scope.cancel()
    except WebSocketDisconnect:
        pass
    finally:
        websocket_connections.labels(channel=channel).dec()
        # Finish cleanup even when the server cancels the connection handler.
        with anyio.CancelScope(shield=True):
            try:
                await pubsub.aclose()
            finally:
                await redis.aclose()


@router.websocket("/ws/dashboard")
async def ws_dashboard(websocket: WebSocket):
    await _relay(websocket, CHANNEL_DASHBOARD)


@router.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    await _relay(websocket, CHANNEL_ALERTS)


@router.websocket("/ws/stations/{station_id}")
async def ws_station(websocket: WebSocket, station_id: str):
    try:
        uuid.UUID(station_id)
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="invalid station id")
        return
    await _relay(websocket, channel_for_station(station_id))
