"""Follow-up Agent — recommends follow-up timing and actions."""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.agents.base import BaseAgent, AgentResult
from app.modules.intelligence.service import intelligence_service

logger = logging.getLogger(__name__)


class FollowupAgent(BaseAgent):
    name = "followup"
    description = "Track applications and recommend follow-up actions"

    async def execute(self, db: AsyncSession, user_id: int, context: dict[str, Any]) -> AgentResult:
        try:
            data = await intelligence_service.get_followup_timing(db, user_id)
            followups = data if isinstance(data, list) else data.get("followups", []) if isinstance(data, dict) else []
            return self._ok({"followups": followups})
        except Exception as e:
            logger.error("Follow-up agent failed: %s", e)
            return self._fail(str(e))
