import asyncio
import json

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.services.event_publisher import publish_dashboard_event


def test_dashboard_websocket_receives_published_event():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/dashboard") as ws:
            async def _publish():
                await asyncio.sleep(0.2)
                await publish_dashboard_event("ANOMALY_CREATED", {"anomaly_id": "abc123"})

            asyncio.get_event_loop_policy()

            import threading

            def run():
                asyncio.run(_publish())

            t = threading.Thread(target=run)
            t.start()

            data = ws.receive_text()
            t.join()

            body = json.loads(data)
            assert body["event_type"] == "ANOMALY_CREATED"
            assert body["payload"]["anomaly_id"] == "abc123"
