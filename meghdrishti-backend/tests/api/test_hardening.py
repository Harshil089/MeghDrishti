import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.security import create_access_token, hash_password
from app.models.users import Role, User, UserRole


async def _user(db_session, active=True):
    role = Role(name="ADMIN")
    db_session.add(role)
    await db_session.flush()
    u = User(email="gone@x.local", hashed_password=hash_password("secret123"), is_active=active)
    db_session.add(u)
    await db_session.flush()
    db_session.add(UserRole(user_id=u.id, role_id=role.id))
    await db_session.commit()
    return u


@pytest.mark.asyncio
async def test_deactivated_user_token_rejected(client, db_session):
    u = await _user(db_session, active=False)
    token = create_access_token(str(u.id), ["ADMIN"])
    resp = await client.get("/api/v1/stations", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_roles_come_from_db_not_token(client, db_session):
    u = await _user(db_session)
    token = create_access_token(str(u.id), ["ADMIN"])
    # Strip the role in DB; the stale ADMIN claim in the token must not grant access.
    from sqlalchemy import delete

    await db_session.execute(delete(UserRole).where(UserRole.user_id == u.id))
    await db_session.commit()
    resp = await client.get("/api/v1/admin/data-sources", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


def test_non_dev_rejects_default_secret():
    with pytest.raises(ValidationError):
        Settings(environment="staging", debug=False, jwt_secret="insecure-dev-secret-change-me", demo_admin_password="real-pw")


def test_non_dev_rejects_default_demo_password():
    with pytest.raises(ValidationError):
        Settings(environment="production", debug=False, jwt_secret="x" * 40, demo_admin_password="change-me")


def test_non_dev_accepts_real_config():
    s = Settings(environment="production", debug=False, jwt_secret="x" * 40, demo_admin_password="real-pw")
    assert s.environment == "production"


@pytest.mark.asyncio
async def test_logout_revokes_refresh_token(client, db_session):
    from app.core.security import create_refresh_token

    u = await _user(db_session)
    rt = create_refresh_token(str(u.id))
    ok = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert ok.status_code == 200

    out = await client.post("/api/v1/auth/logout", json={"refresh_token": rt})
    assert out.status_code == 204
    again = await client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert again.status_code == 401


def test_ws_rejects_non_uuid_station_id():
    from starlette.testclient import TestClient
    from starlette.websockets import WebSocketDisconnect

    from app.main import app

    token = create_access_token("00000000-0000-0000-0000-000000000001", ["ADMIN"])
    with TestClient(app) as c, pytest.raises(WebSocketDisconnect):
        with c.websocket_connect(f"/ws/stations/not-a-uuid?token={token}") as ws:
            ws.receive_text()
