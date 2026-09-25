import pytest

from app.core.security import hash_password
from app.models.users import Role, User, UserRole


async def _create_user(db_session, email="op@meghdrishti.local", role="OPERATOR"):
    r = Role(name=role)
    db_session.add(r)
    await db_session.flush()
    u = User(email=email, hashed_password=hash_password("secret123"), full_name="Op User")
    db_session.add(u)
    await db_session.flush()
    db_session.add(UserRole(user_id=u.id, role_id=r.id))
    await db_session.commit()
    return u


@pytest.mark.asyncio
async def test_login_success(client, db_session):
    await _create_user(db_session)
    resp = await client.post(
        "/api/v1/auth/login", data={"username": "op@meghdrishti.local", "password": "secret123"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert "refresh_token" in body


@pytest.mark.asyncio
async def test_login_wrong_password(client, db_session):
    await _create_user(db_session)
    resp = await client.post(
        "/api/v1/auth/login", data={"username": "op@meghdrishti.local", "password": "wrong"}
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_me_requires_token(client, db_session):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_roles(client, db_session):
    await _create_user(db_session)
    login = await client.post(
        "/api/v1/auth/login", data={"username": "op@meghdrishti.local", "password": "secret123"}
    )
    token = login.json()["access_token"]
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["roles"] == ["OPERATOR"]


@pytest.mark.asyncio
async def test_refresh_token_flow(client, db_session):
    await _create_user(db_session)
    login = await client.post(
        "/api/v1/auth/login", data={"username": "op@meghdrishti.local", "password": "secret123"}
    )
    refresh_token = login.json()["refresh_token"]
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert "access_token" in resp.json()
