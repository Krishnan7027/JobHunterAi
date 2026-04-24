"""Agent orchestrator — runs agents in sequence, passing context between them."""

import datetime
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.agents.base import AgentResult, AgentStatus
from app.modules.agents.job_finder import JobFinderAgent
from app.modules.agents.job_scorer import JobScorerAgent
from app.modules.agents.strategy import StrategyAgent
from app.modules.agents.outreach import OutreachAgent
from app.modules.agents.followup import FollowupAgent
from app.modules.agents.analytics_agent import AnalyticsAgent

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """Sequences agent execution, passes context between agents.

    Safety: Agents DO NOT auto-apply. They only assist the user.
    """

    def __init__(self) -> None:
        self.agents = [
            JobFinderAgent(),
            JobScorerAgent(),
            StrategyAgent(),
            OutreachAgent(),
            FollowupAgent(),
            AnalyticsAgent(),
        ]

    async def execute_plan(
        self,
        db: AsyncSession,
        user_id: int,
        query: str | None = None,
        location: str | None = None,
        skip_fetch: bool = False,
    ) -> dict[str, Any]:
        """Execute the full agent pipeline.

        Flow: Fetch → Score → Strategize → Outreach → Follow-up → Analytics
        """
        started_at = datetime.datetime.utcnow()
        logger.info("=== Agent Pipeline START for user %d (query=%s) ===", user_id, query)
        context: dict[str, Any] = {
            "query": query,
            "location": location,
            "skip_fetch": skip_fetch or not query,
        }
        results: list[AgentResult] = []

        for agent in self.agents:
            agent_start = datetime.datetime.utcnow()
            try:
                result = await agent.execute(db, user_id, context)
                result.started_at = agent_start
                result.completed_at = datetime.datetime.utcnow()
                result.duration_ms = int(
                    (result.completed_at - agent_start).total_seconds() * 1000
                )

                # Merge agent output into context for next agent
                context.update(result.data)
                results.append(result)

                logger.info(
                    "Agent %s completed: %s (%dms)",
                    agent.name,
                    result.status,
                    result.duration_ms,
                )
            except Exception as e:
                logger.error("Agent %s failed: %s", agent.name, str(e))
                result = AgentResult(
                    agent_name=agent.name,
                    status=AgentStatus.FAILED,
                    error=str(e),
                    started_at=agent_start,
                    completed_at=datetime.datetime.utcnow(),
                )
                result.duration_ms = int(
                    (result.completed_at - agent_start).total_seconds() * 1000
                )
                results.append(result)
                # Continue — don't block pipeline on one failure

        completed_at = datetime.datetime.utcnow()
        total_ms = int((completed_at - started_at).total_seconds() * 1000)

        succeeded = sum(1 for r in results if r.status == AgentStatus.COMPLETED)
        failed = sum(1 for r in results if r.status == AgentStatus.FAILED)
        skipped = sum(1 for r in results if r.status == AgentStatus.SKIPPED)
        logger.info(
            "=== Agent Pipeline END (%dms) — %d ok, %d failed, %d skipped ===",
            total_ms, succeeded, failed, skipped,
        )

        return {
            "status": "completed",
            "started_at": started_at.isoformat(),
            "completed_at": completed_at.isoformat(),
            "duration_ms": total_ms,
            "agents": [
                {
                    "name": r.agent_name,
                    "status": r.status.value,
                    "duration_ms": r.duration_ms,
                    "error": r.error,
                }
                for r in results
            ],
            "plan": {
                "jobs_found": context.get("jobs_found", 0),
                "jobs_scored": context.get("scored", 0),
                "jobs_to_apply": context.get("apply", []),
                "jobs_to_skip": context.get("skip", []),
                "messages": context.get("messages", []),
                "followups": context.get("followups", []),
                "analytics": context.get("analytics", {}),
            },
        }


orchestrator = AgentOrchestrator()
