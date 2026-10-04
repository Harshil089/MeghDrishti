"""FastAPI application entrypoint."""
from __future__ import annotations

import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from app.api import websocket as websocket_api
from app.api.router import api_router
from app.core.config import settings
from app.db.session import get_redis
from app.core.exceptions import AppError, app_error_handler, unhandled_error_handler
from app.core.logging import configure_logging, get_logger, new_request_id, request_id_ctx
from app.db.session import check_db_health, check_redis_health

configure_logging()
logger = get_logger("meghdrishti.main")

app = FastAPI(
    title="MeghDrishti Backend",
    description="AI/ML-based intelligent anomaly detection for Automatic Weather Stations",
    version="0.1.0",
    # Route map is only exposed in local development.
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.environment == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    rid = request.headers.get("X-Request-ID", new_request_id())
    token = request_id_ctx.set(rid)
    start = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        request_id_ctx.reset(token)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = rid
    logger.info(
        "http_request",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round(duration_ms, 2),
    )
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    origin = request.headers.get("origin")
    if request.method not in {"GET", "HEAD", "OPTIONS"} and origin is not None and origin not in settings.cors_origins:
        return JSONResponse(status_code=403, content={"error": {
            "code": "ORIGIN_NOT_ALLOWED", "message": "Request origin is not allowed", "details": {}
        }})
    # ponytail: per-IP fixed window for all writes; per-user/endpoint limits if abuse shows up.
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        ip = request.client.host if request.client else "unknown"
        async with get_redis() as redis:
            count = await redis.incr(f"ratelimit:write:{ip}")
            if count == 1:
                await redis.expire(f"ratelimit:write:{ip}", 60)
        if count > settings.write_rate_limit_per_minute:
            return JSONResponse(status_code=429, content={"error": {
                "code": "RATE_LIMITED", "message": "Too many write requests", "details": {}
            }})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if not settings.debug:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


if settings.prometheus_enabled:
    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

app.include_router(api_router, prefix=settings.api_v1_prefix)
app.include_router(websocket_api.router, tags=["websocket"])


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": settings.app_name}


@app.get("/ready", tags=["system"])
async def ready():
    db_ok = await check_db_health()
    redis_ok = await check_redis_health()
    ok = db_ok and redis_ok
    return JSONResponse(status_code=200 if ok else 503, content={
        "status": "ready" if ok else "not_ready",
        "checks": {"database": db_ok, "redis": redis_ok},
    })
