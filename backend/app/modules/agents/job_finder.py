"""Job Finder Agent — discovers jobs from configured sources."""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.modules.agents.base import BaseAgent, AgentResult
from app.modules.jobs.models import Job
from app.modules.jobs.service import job_service
from app.modules.scraper.job_orchestrator import get_jobs

logger = logging.getLogger(__name__)


class JobFinderAgent(BaseAgent):
    name = "job_finder"
    description = "Discover and save new jobs from multiple sources"

    async def execute(self, db: AsyncSession, user_id: int, context: dict[str, Any]) -> AgentResult:
        if context.get("skip_fetch"):
            # Use existing jobs instead of scraping
            result = await db.execute(
                select(Job)
                .where(Job.user_id == user_id)
                .order_by(Job.created_at.desc())
                .limit(20)
            )
            existing = result.scalars().all()
            return self._ok({
                "jobs_found": len(existing),
                "jobs": [
                    {"id": j.id, "title": j.title, "company": j.company, "platform": j.platform}
                    for j in existing
                ],
            })

        query = context.get("query", "software engineer")
        location = context.get("location")

        try:
            raw_jobs, source = await get_jobs(
                query=query,
                location=location,
                sources=["google"],
                max_results=20,
            )
        except Exception as e:
            logger.error("Job scraping failed: %s", e)
            return self._fail(f"Scraping failed: {e}")

        saved = 0
        job_refs = []
        for raw in raw_jobs:
            job = await job_service.create_job_from_raw(db, user_id, raw)
            if job:
                saved += 1
                job_refs.append({
                    "id": job.id, "title": job.title,
                    "company": job.company, "platform": job.platform,
                })

        await db.commit()

        return self._ok({
            "jobs_found": saved,
            "jobs": job_refs,
            "source": source,
        })
