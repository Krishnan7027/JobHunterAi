"""Agent system request/response schemas."""

from pydantic import BaseModel
from typing import Any


class AgentPlanRequest(BaseModel):
    query: str | None = None
    location: str | None = None
    skip_fetch: bool = False


class AgentStepResult(BaseModel):
    name: str
    status: str
    duration_ms: int
    error: str | None = None


class AgentPlanResponse(BaseModel):
    status: str
    started_at: str
    completed_at: str
    duration_ms: int
    agents: list[AgentStepResult]
    plan: dict[str, Any]
