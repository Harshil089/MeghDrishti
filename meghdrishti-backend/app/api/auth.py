from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import UnauthorizedError
from app.core.rate_limit import rate_limit
from app.db.session import get_db
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RefreshRequest, TokenPair, UserOut
from app.services.auth_service import AuthService

router = APIRouter()


class GoogleLoginRequest(BaseModel):
    id_token: str


@router.post("/login", response_model=TokenPair, dependencies=[Depends(rate_limit("login", max_requests=10, window_seconds=60))])
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
):
    service = AuthService(db)
    user = await service.authenticate(form_data.username, form_data.password)
    return service.issue_tokens(user)


@router.post("/google", response_model=TokenPair, dependencies=[Depends(rate_limit("login", max_requests=10, window_seconds=60))])
async def google_login(payload: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    user = await service.authenticate_google(payload.id_token)
    return service.issue_tokens(user)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    return await service.refresh(payload.refresh_token)


@router.get("/me", response_model=UserOut)
async def me(current=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.get_by_id(current.id)
    if user is None:
        raise UnauthorizedError("User no longer exists")
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=user.role_names,
        is_active=user.is_active,
    )
