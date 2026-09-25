"""Data access for users/roles."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.users import Role, User, UserRole


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str) -> User | None:
        stmt = (
            select(User)
            .where(User.email == email)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id) -> User | None:
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_or_create_role(self, name: str) -> Role:
        result = await self.session.execute(select(Role).where(Role.name == name))
        role = result.scalar_one_or_none()
        if role is None:
            role = Role(name=name)
            self.session.add(role)
            await self.session.flush()
        return role

    async def create_user(
        self, email: str, hashed_password: str, full_name: str, role_names: list[str]
    ) -> User:
        user = User(email=email, hashed_password=hashed_password, full_name=full_name)
        self.session.add(user)
        await self.session.flush()
        for name in role_names:
            role = await self.get_or_create_role(name)
            self.session.add(UserRole(user_id=user.id, role_id=role.id))
        await self.session.commit()
        # refresh() only reloads the user_roles collection, not each row's
        # nested .role — that lazy-loads later outside the async greenlet
        # context and raises MissingGreenlet. Re-fetch with the same
        # selectinload chain get_by_email/get_by_id use instead.
        created = await self.get_by_id(user.id)
        assert created is not None
        return created
