from __future__ import annotations

from pydantic import BaseModel


class RuleResult(BaseModel):
    rule: str
    triggered: bool
    score: float
    severity: str
    reason_code: str | None = None
    evidence: dict = {}


class ObservationPoint(BaseModel):
    """Minimal shape rules need: a timestamp + a measurement value."""

    timestamp: object
    values: dict[str, float | None]
