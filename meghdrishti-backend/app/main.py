"""FastAPI application entrypoint."""
from __future__ import annotations

import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.api import websocket as websocket_api
from app.api.router import api_router
from app.core.config import settings
from app.core.exceptions import AppError, app_error_handler, unhandled_error_handler
from app.core.logging import configure_logging, get_logger, new_request_id, request_id_ctx
from app.db.session import check_db_health, check_redis_health

configure_logging()
logger = get_logger("meghdrishti.main")

app = FastAPI(
    title="MeghDrishti Backend",
    description="AI/ML-based intelligent anomaly detection for Automatic Weather Stations",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    return {
        "status": "ready" if ok else "not_ready",
        "checks": {"database": db_ok, "redis": redis_ok},
    }
