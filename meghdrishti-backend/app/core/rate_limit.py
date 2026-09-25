"""Minimal Redis-backed rate limiter for sensitive endpoints (login, etc.)."""
from __future__ import annotations

from fastapi import Request

from app.core.exceptions import AppError
from app.db.session import get_redis


class RateLimitedError(AppError):
    status_code = 429
    code = "RATE_LIMITED"


def rate_limit(key_prefix: str, max_requests: int = 10, window_seconds: int = 60):
    async def _checker(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        key = f"ratelimit:{key_prefix}:{client_ip}"
        redis = get_redis()
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, window_seconds)
        if count > max_requests:
            raise RateLimitedError(f"Too many requests, try again in {window_seconds}s")

    return _checker
