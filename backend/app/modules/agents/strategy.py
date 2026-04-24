"""Strategy Agent — recommends which jobs to apply to or skip."""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.agents.base import BaseAgent, AgentResult
from app.modules.intelligence.service import intelligence_service

logger = logging.getLogger(__name__)


class StrategyAgent(BaseAgent):
    name = "strategy"
    description = "Decide which jobs to apply to and which to skip"

    async def execute(self, db: AsyncSession, user_id: int, context: dict[str, Any]) -> AgentResult:
        try:
            data = await intelligence_service.get_strategy(db, user_id)
            return self._ok({
                "apply": data.get("apply", []),
                "skip": data.get("skip", []),
                "strategy_summary": data.get("summary", ""),
            })
        except Exception as e:
            logger.error("Strategy agent failed: %s", e)
            return self._fail(str(e))
