from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.qc import QCRuleResult
from app.schemas.qc import RuleResult


class QCRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def bulk_create(self, observation_id: uuid.UUID, results: list[RuleResult]) -> list[QCRuleResult]:
        rows = [
            QCRuleResult(
                observation_id=observation_id,
                rule=r.rule,
                triggered=r.triggered,
                score=r.score,
                severity=r.severity,
                reason_code=r.reason_code,
                evidence=r.evidence,
            )
            for r in results
        ]
        self.session.add_all(rows)
        await self.session.commit()
        return rows
