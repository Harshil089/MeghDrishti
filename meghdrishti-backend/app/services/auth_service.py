"""Authentication business logic: verify credentials, issue/refresh JWTs."""
from __future__ import annotations

import secrets

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError
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

    async def refresh(self, refresh_token: str) -> TokenPair:
        try:
            payload = decode_token(refresh_token)
        except ValueError as exc:
            raise UnauthorizedError("Invalid refresh token") from exc
        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")
        user = await self.repo.get_by_id(payload["sub"])
        if user is None or not user.is_active:
            raise UnauthorizedError("User no longer active")
        return self.issue_tokens(user)

    async def authenticate_google(self, id_token: str) -> User:
        try:
            payload = await verify_google_id_token(id_token)
        except GoogleTokenError as exc:
            raise UnauthorizedError(str(exc)) from exc

        email = payload["email"]
        user = await self.repo.get_by_email(email)
        if user is not None:
            if not user.is_active:
                raise UnauthorizedError("User no longer active")
            return user

        # First Google sign-in for this email: provision a VIEWER account.
        # No usable password — hashed_password is required by the schema but
        # this account can only ever authenticate via Google.
        return await self.repo.create_user(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=payload.get("name", email),
            role_names=["VIEWER"],
        )
