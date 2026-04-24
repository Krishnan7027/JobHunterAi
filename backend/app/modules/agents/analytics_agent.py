"""Analytics Agent — gathers performance metrics from context or DB."""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.modules.agents.base import BaseAgent, AgentResult
from app.modules.jobs.models import Job

logger = logging.getLogger(__name__)


class AnalyticsAgent(BaseAgent):
    name = "analytics"
    description = "Track job hunting performance metrics"

    async def execute(self, db: AsyncSession, user_id: int, context: dict[str, Any]) -> AgentResult:
        try:
            # Single query — count all statuses at once
            rows = (await db.execute(
                select(Job.status, func.count(Job.id))
                .where(Job.user_id == user_id)
                .group_by(Job.status)
            )).all()

            counts: dict[str, int] = {}
            total = 0
            for status, count in rows:
                counts[status] = count
                total += count

            applied = counts.get("applied", 0)
            interview = counts.get("interview", 0)
            offered = counts.get("offered", 0)
            rejected = counts.get("rejected", 0)
            saved = counts.get("saved", 0)
            total_apps = applied + interview + offered + rejected

            analytics = {
                "total_jobs": total,
                "applied": applied,
                "saved": saved,
                "interviews": interview,
                "offers": offered,
                "rejected": rejected,
                "conversion_rate": round((interview / total_apps) * 100, 1) if total_apps > 0 else 0,
                "offer_rate": round((offered / total_apps) * 100, 1) if total_apps > 0 else 0,
                "jobs_found_this_run": context.get("jobs_found", 0),
                "jobs_scored_this_run": context.get("scored", 0),
            }

            return self._ok({"analytics": analytics})
        except Exception as e:
            logger.error("Analytics agent failed: %s", e)
            return self._fail(str(e))
