from unittest.mock import AsyncMock, patch

import pytest

from app.models.users import User


@pytest.mark.asyncio
async def test_google_login_creates_viewer_on_first_sign_in(client, db_session):
    fake_payload = {"email": "newperson@gmail.com", "name": "New Person", "email_verified": True, "sub": "123"}
    with patch("app.services.auth_service.verify_google_id_token", new=AsyncMock(return_value=fake_payload)):
        resp = await client.post("/api/v1/auth/google", json={"id_token": "fake"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body

    from sqlalchemy import select

    user = (await db_session.execute(select(User).where(User.email == "newperson@gmail.com"))).scalar_one()
    assert user.full_name == "New Person"


@pytest.mark.asyncio
async def test_google_login_reuses_existing_user(client, db_session):
    from app.core.security import hash_password
    from app.models.users import Role, UserRole

    role = Role(name="OPERATOR")
    db_session.add(role)
    await db_session.flush()
    user = User(email="existing@gmail.com", hashed_password=hash_password("whatever"))
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserRole(user_id=user.id, role_id=role.id))
    await db_session.commit()

    fake_payload = {"email": "existing@gmail.com", "name": "Existing", "email_verified": True, "sub": "456"}
    with patch("app.services.auth_service.verify_google_id_token", new=AsyncMock(return_value=fake_payload)):
        resp = await client.post("/api/v1/auth/google", json={"id_token": "fake"})
    assert resp.status_code == 200

    token = resp.json()["access_token"]
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["roles"] == ["OPERATOR"]


@pytest.mark.asyncio
async def test_google_login_rejects_unverified_email(client, db_session):
    from app.core.google_auth import GoogleTokenError

    with patch(
        "app.services.auth_service.verify_google_id_token",
        new=AsyncMock(side_effect=GoogleTokenError("Google email not verified")),
    ):
        resp = await client.post("/api/v1/auth/google", json={"id_token": "fake"})
    assert resp.status_code == 401
