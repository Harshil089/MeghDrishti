from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


class AuditRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def log(
        self,
        actor_id: uuid.UUID | None,
        action: str,
        entity_type: str,
        entity_id: str | None,
        before: dict | None = None,
        after: dict | None = None,
        metadata: dict | None = None,
    ) -> AuditLog:
        row = AuditLog(
            actor_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before=before,
            after=after,
            audit_metadata=metadata or {},
        )
        self.session.add(row)
        await self.session.commit()
        return row
