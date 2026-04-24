"""Base agent class for the multi-agent system."""

import datetime
import logging
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class AgentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class AgentResult:
    agent_name: str
    status: AgentStatus
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    started_at: datetime.datetime | None = None
    completed_at: datetime.datetime | None = None
    duration_ms: int = 0


class BaseAgent(ABC):
    """Abstract base for all agents."""

    name: str = "base"
    description: str = ""

    @abstractmethod
    async def execute(self, db: Any, user_id: int, context: dict[str, Any]) -> AgentResult:
        """Run the agent. Context carries data from previous agents."""
        ...

    def _ok(self, data: dict | None = None) -> AgentResult:
        return AgentResult(agent_name=self.name, status=AgentStatus.COMPLETED, data=data or {})

    def _fail(self, error: str) -> AgentResult:
        return AgentResult(agent_name=self.name, status=AgentStatus.FAILED, error=error)

    def _skip(self, reason: str = "") -> AgentResult:
        return AgentResult(agent_name=self.name, status=AgentStatus.SKIPPED, error=reason)
