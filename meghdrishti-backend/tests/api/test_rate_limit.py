import pytest


@pytest.mark.asyncio
async def test_login_rate_limited_after_threshold(client, db_session):
    for _ in range(10):
        resp = await client.post("/api/v1/auth/login", data={"username": "nobody@x.local", "password": "wrong"})
        assert resp.status_code == 401

    resp = await client.post("/api/v1/auth/login", data={"username": "nobody@x.local", "password": "wrong"})
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMITED"
