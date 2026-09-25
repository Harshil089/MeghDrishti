from datetime import datetime, timezone

import pytest

from app.core.security import hash_password
from app.models.calibration import CalibrationProfile
from app.models.stations import DataSource, Station
from app.models.users import Role, User, UserRole


@pytest.mark.asyncio
async def test_get_active_calibration_none(client, db_session):
    resp = await client.get("/api/v1/admin/calibration")
    assert resp.status_code == 200
    assert resp.json()["data"] is None


@pytest.mark.asyncio
async def test_get_active_calibration_present(client, db_session):
    db_session.add(
        CalibrationProfile(
            name="default", is_active=True, rule_thresholds={}, fusion_weights={},
            decision_thresholds={}, health_weights={}, health_boundaries={},
        )
    )
    await db_session.commit()
    resp = await client.get("/api/v1/admin/calibration")
    assert resp.status_code == 200
    assert resp.json()["data"]["name"] == "default"


@pytest.mark.asyncio
async def test_list_data_sources(client, db_session):
    db_session.add(DataSource(name="OPEN_METEO", kind="FORECAST_API", is_enabled=True, config={}))
    await db_session.commit()
    resp = await client.get("/api/v1/admin/data-sources")
    assert resp.status_code == 200
    assert any(s["name"] == "OPEN_METEO" for s in resp.json()["data"])


@pytest.mark.asyncio
async def test_trigger_ingestion_requires_permission(client, db_session):
    station = Station(station_code="ADMIN001", name="Admin Test", source="TEST", latitude=1.0, longitude=1.0)
    db_session.add(station)
    await db_session.commit()

    resp = await client.post(f"/api/v1/admin/ingest/{station.id}")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_trigger_ingestion_as_admin(client, db_session):
    role = Role(name="ADMIN")
    db_session.add(role)
    await db_session.flush()
    user = User(email="admin3@x.local", hashed_password=hash_password("secret123"))
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserRole(user_id=user.id, role_id=role.id))

    station = Station(station_code="ADMIN002", name="Admin Test 2", source="TEST", latitude=18.5, longitude=73.8)
    db_session.add(station)
    await db_session.commit()

    login = await client.post("/api/v1/auth/login", data={"username": "admin3@x.local", "password": "secret123"})
    token = login.json()["access_token"]

    resp = await client.post(
        f"/api/v1/admin/ingest/{station.id}?source=OPEN_METEO&window_minutes=30",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert "job_id" in resp.json()["data"]
