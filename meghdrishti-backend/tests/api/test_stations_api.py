import pytest

from app.core.security import hash_password
from app.models.users import Role, User, UserRole


async def _admin_token(client, db_session):
    r = Role(name="ADMIN")
    db_session.add(r)
    await db_session.flush()
    u = User(email="admin@x.local", hashed_password=hash_password("secret123"))
    db_session.add(u)
    await db_session.flush()
    db_session.add(UserRole(user_id=u.id, role_id=r.id))
    await db_session.commit()
    resp = await client.post("/api/v1/auth/login", data={"username": "admin@x.local", "password": "secret123"})
    return resp.json()["access_token"]


@pytest.mark.asyncio
async def test_create_and_list_station(client, db_session):
    token = await _admin_token(client, db_session)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/v1/stations",
        json={
            "station_code": "API001",
            "name": "API Test Station",
            "source": "IMD",
            "latitude": 18.5,
            "longitude": 73.8,
        },
        headers=headers,
    )
    assert resp.status_code == 200
    station_id = resp.json()["data"]["id"]

    resp = await client.get("/api/v1/stations")
    assert resp.status_code == 200
    assert any(s["id"] == station_id for s in resp.json()["data"])

    resp = await client.get(f"/api/v1/stations/{station_id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["station_code"] == "API001"


@pytest.mark.asyncio
async def test_station_not_found_returns_error_envelope(client, db_session):
    import uuid

    resp = await client.get(f"/api/v1/stations/{uuid.uuid4()}")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "STATION_NOT_FOUND"


@pytest.mark.asyncio
async def test_dashboard_summary(client, db_session):
    resp = await client.get("/api/v1/dashboard/summary")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert "stations" in body
    assert "alerts" in body
