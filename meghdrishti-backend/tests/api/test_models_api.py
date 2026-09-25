import pytest

from app.core.security import hash_password
from app.ml.registry import ModelRegistry
from app.ml.training import train_isolation_forest
from app.models.users import Role, User, UserRole


def _rows(n=30):
    import random

    rng = random.Random(1)
    return [{"value": 24 + rng.uniform(-1, 1)} for _ in range(n)]


@pytest.mark.asyncio
async def test_list_and_get_model(client, db_session):
    trained = train_isolation_forest(_rows(), ["value"])
    model = await ModelRegistry(db_session).register_candidate("temperature_c", trained)

    resp = await client.get("/api/v1/models")
    assert resp.status_code == 200
    assert any(m["id"] == str(model.id) for m in resp.json()["data"])

    resp = await client.get(f"/api/v1/models/{model.id}")
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "CANDIDATE"


@pytest.mark.asyncio
async def test_activate_model_requires_permission(client, db_session):
    trained = train_isolation_forest(_rows(), ["value"])
    model = await ModelRegistry(db_session).register_candidate("temperature_c", trained)

    resp = await client.post(f"/api/v1/models/{model.id}/activate")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_activate_model_as_admin(client, db_session):
    role = Role(name="ADMIN")
    db_session.add(role)
    await db_session.flush()
    user = User(email="admin2@x.local", hashed_password=hash_password("secret123"))
    db_session.add(user)
    await db_session.flush()
    db_session.add(UserRole(user_id=user.id, role_id=role.id))
    await db_session.commit()

    trained = train_isolation_forest(_rows(), ["value"])
    model = await ModelRegistry(db_session).register_candidate("temperature_c", trained)

    login = await client.post("/api/v1/auth/login", data={"username": "admin2@x.local", "password": "secret123"})
    token = login.json()["access_token"]

    resp = await client.post(f"/api/v1/models/{model.id}/activate", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["data"]["status"] == "ACTIVE"
