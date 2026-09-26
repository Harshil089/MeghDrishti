"""Shared pytest fixtures: sqlite-backed async engine, app client, auth headers."""
from __future__ import annotations

import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://meghdrishti:meghdrishti@localhost:5432/meghdrishti_test",
)
os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
import app.models  # noqa: F401 populate metadata

TEST_DB_URL = os.environ["DATABASE_URL"]


@pytest.fixture(autouse=True)
def _isolate_model_store(tmp_path, monkeypatch):
    """Tests that train/register models must never write into the real model_store/."""
    import app.ml.registry as registry

    monkeypatch.setattr(registry, "MODEL_STORE", tmp_path)


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(TEST_DB_URL, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncSession:
    session_maker = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)
    async with session_maker() as session:
        yield session


@pytest_asyncio.fixture
async def app_with_db(db_engine):
    from app.api import deps
    from app.db import session as db_session_mod
    from app.main import app

    session_maker = async_sessionmaker(db_engine, expire_on_commit=False, class_=AsyncSession)

    async def _get_db_override():
        async with session_maker() as session:
            yield session

    app.dependency_overrides[deps.get_current_user] = app.dependency_overrides.get(
        deps.get_current_user, deps.get_current_user
    )
    from app.db.session import get_db

    app.dependency_overrides[get_db] = _get_db_override
    yield app
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app_with_db):
    from app.db.session import get_redis

    redis = get_redis()
    keys = [k async for k in redis.scan_iter("ratelimit:*")]
    if keys:
        await redis.delete(*keys)

    transport = ASGITransport(app=app_with_db)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
