from __future__ import annotations

import uuid

from pydantic import BaseModel


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    roles: list[str]
    is_active: bool

    model_config = {"from_attributes": True}
