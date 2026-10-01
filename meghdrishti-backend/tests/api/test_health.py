from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
@pytest.mark.parametrize("db_ok,redis_ok", [(True, True), (False, True), (True, False), (False, False)])
async def test_ready_reports_dependency_status(monkeypatch, db_ok, redis_ok):
    monkeypatch.setattr("app.main.check_db_health", AsyncMock(return_value=db_ok))
    monkeypatch.setattr("app.main.check_redis_health", AsyncMock(return_value=redis_ok))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/ready")
    assert resp.status_code == (200 if db_ok and redis_ok else 503)
    body = resp.json()
    assert body["status"] == ("ready" if db_ok and redis_ok else "not_ready")
    assert body["checks"] == {"database": db_ok, "redis": redis_ok}
