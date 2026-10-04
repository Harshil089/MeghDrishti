"""Authentication business logic: verify credentials, issue/refresh JWTs."""
from __future__ import annotations

import secrets
import time

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError
from app.db.session import get_redis
from app.core.google_auth import GoogleTokenError, verify_google_id_token
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.users import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TokenPair


class AuthService:
    def __init__(self, session: AsyncSession):
        self.repo = UserRepository(session)

    async def authenticate(self, email: str, password: str) -> User:
        user = await self.repo.get_by_email(email)
        if user is None or not user.is_active or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Incorrect email or password")
        return user

    def issue_tokens(self, user: User) -> TokenPair:
        roles = user.role_names
        return TokenPair(
            access_token=create_access_token(str(user.id), roles),
            refresh_token=create_refresh_token(str(user.id)),
        )

    async def logout(self, refresh_token: str) -> None:
        try:
            payload = decode_token(refresh_token)
        except ValueError as exc:
            raise UnauthorizedError("Invalid refresh token") from exc
        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")
        # Denylist until the token would have expired anyway.
        ttl = max(int(payload["exp"] - time.time()), 1)
        async with get_redis() as redis:
            await redis.set(f"revoked:refresh:{payload['jti']}", "1", ex=ttl)

    async def refresh(self, refresh_token: str) -> TokenPair:
        try:
            payload = decode_token(refresh_token)
        except ValueError as exc:
            raise UnauthorizedError("Invalid refresh token") from exc
        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")
        async with get_redis() as redis:
            if await redis.exists(f"revoked:refresh:{payload.get('jti')}"):
                raise UnauthorizedError("Refresh token revoked")
        user = await self.repo.get_by_id(payload["sub"])
        if user is None or not user.is_active:
            raise UnauthorizedError("User no longer active")
        return self.issue_tokens(user)

    async def authenticate_google(self, id_token: str) -> User:
        try:
            payload = await verify_google_id_token(id_token)
        except GoogleTokenError as exc:
            raise UnauthorizedError(str(exc)) from exc

        sub = str(payload["sub"])
        email = payload["email"]

        # Bound Google account: match on the immutable subject id only.
        user = await self.repo.get_by_google_sub(sub)
        if user is not None:
            if not user.is_active:
                raise UnauthorizedError("User no longer active")
            return user

        user = await self.repo.get_by_email(email)
        if user is not None:
            # Existing account with a different Google identity bound: refuse.
            if user.google_sub is not None and user.google_sub != sub:
                raise UnauthorizedError("Google account does not match this user")
            if not user.is_active:
                raise UnauthorizedError("User no longer active")
            # First Google sign-in for a pre-existing account: bind the subject id.
            user.google_sub = sub
            await self.repo.session.commit()
            return user

        # First Google sign-in for this email: provision a VIEWER account.
        # No usable password — hashed_password is required by the schema but
        # this account can only ever authenticate via Google.
        user = await self.repo.create_user(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=payload.get("name", email),
            role_names=["VIEWER"],
        )
        user.google_sub = sub
        await self.repo.session.commit()
        return user
