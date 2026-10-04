"""Shared FastAPI dependencies: DB session, current user, pagination."""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError
from app.core.security import decode_token
from app.db.session import get_db
from app.repositories.user_repository import UserRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


@dataclass
class CurrentUser:
    id: str
    email: str
    roles: list[str]


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if not token:
        raise UnauthorizedError("Not authenticated")
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise UnauthorizedError("Invalid or expired token") from exc
    if payload.get("type") != "access":
        raise UnauthorizedError("Invalid token type")
    # Re-check the account on every request so deactivation and role changes
    # take effect immediately instead of waiting for the access token to expire.
    user = await UserRepository(db).get_by_id(payload["sub"])
    if user is None or not user.is_active:
        raise UnauthorizedError("User no longer active")
    return CurrentUser(id=str(user.id), email=user.email, roles=user.role_names)


@dataclass
class Pagination:
    limit: int
    offset: int


def pagination_params(
    limit: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0)
) -> Pagination:
    return Pagination(limit=limit, offset=offset)


DbSession = AsyncSession
