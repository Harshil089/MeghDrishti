"""Async SQLAlchemy engine/session + Redis client, both lazily constructed."""
from __future__ import annotations

from collections.abc import AsyncGenerator

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine, expire_on_commit=False, class_=AsyncSession
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


def get_redis() -> redis.Redis:
    # A cached singleton would bind its connection to whichever asyncio event
    # loop created it; tests (and some worker contexts) run each unit on its
    # own loop, so a fresh client per call is created instead.
    return redis.from_url(settings.redis_url, decode_responses=True)


async def check_db_health() -> bool:
    from sqlalchemy import text

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


async def check_redis_health() -> bool:
    try:
        client = get_redis()
        return bool(await client.ping())
    except Exception:
        return False
