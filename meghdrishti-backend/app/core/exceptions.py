"""Custom domain exceptions and frontend-friendly error envelope."""
from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base application error mapped to a frontend-friendly error envelope."""

    status_code: int = 400
    code: str = "APP_ERROR"

    def __init__(self, message: str, details: dict[str, Any] | None = None, code: str | None = None):
        self.message = message
        self.details = details or {}
        if code:
            self.code = code
        super().__init__(message)


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ValidationAppError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"


class UpstreamServiceError(AppError):
    status_code = 502
    code = "UPSTREAM_SERVICE_ERROR"


def error_envelope(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_envelope(exc.code, exc.message, exc.details),
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=error_envelope("INTERNAL_ERROR", "Internal server error", {}),
    )
