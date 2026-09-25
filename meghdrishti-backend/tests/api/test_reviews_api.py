from datetime import datetime, timezone

import pytest

from app.core.security import hash_password
from app.models.anomalies import Anomaly
from app.models.observations import WeatherObservation
from app.models.stations import Station
from app.models.users import Role, User, UserRole


@pytest.mark.asyncio
async def test_operator_review_creates_label_and_audit_log(client, db_session):
    role = Role(name="OPERATOR")
    db_session.add(role)
    await db_session.flush()
    user = User(email="op2@x.local", hashed_password=hash_password("secret123"))
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserRole(user_id=user.id, role_id=role.id))

    station = Station(station_code="REV001", name="Review Test", source="TEST", latitude=1.0, longitude=1.0)
    db_session.add(station)
    await db_session.commit()

    ts = datetime.now(timezone.utc)
    obs = WeatherObservation(station_id=station.id, timestamp=ts, source="TEST", received_at=ts)
    db_session.add(obs)
    await db_session.commit()

    anomaly = Anomaly(
        observation_id=obs.id, station_id=station.id, classification="SUSPICIOUS",
        severity="MEDIUM", fault_score=0.6, confidence=0.5, reason_codes=[],
    )
    db_session.add(anomaly)
    await db_session.commit()

    login = await client.post("/api/v1/auth/login", data={"username": "op2@x.local", "password": "secret123"})
    token = login.json()["access_token"]

    resp = await client.post(
        f"/api/v1/anomalies/{anomaly.id}/review",
        json={"operator_classification": "FALSE_POSITIVE", "comment": "Sensor was fine, just windy"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["operator_classification"] == "FALSE_POSITIVE"
    assert body["previous_classification"] == "SUSPICIOUS"

    from sqlalchemy import select
    from app.models.audit import AuditLog

    result = await db_session.execute(select(AuditLog).where(AuditLog.action == "review_created"))
    audit_rows = result.scalars().all()
    assert len(audit_rows) == 1
