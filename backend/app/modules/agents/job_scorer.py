"""Job Scoring Agent — ranks jobs against user profile."""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.agents.base import BaseAgent, AgentResult
from app.modules.jobs.models import Job
from app.modules.profile.models import Profile
from app.modules.ai.service import ai_service

logger = logging.getLogger(__name__)


class JobScorerAgent(BaseAgent):
    name = "job_scorer"
    description = "Score and rank jobs against user profile"

    async def execute(self, db: AsyncSession, user_id: int, context: dict[str, Any]) -> AgentResult:
        # Get user profile
        result = await db.execute(
            select(Profile).where(Profile.user_id == user_id).order_by(Profile.created_at.desc())
        )
        profile = result.scalar_one_or_none()
        if not profile:
            return self._skip("No profile uploaded — cannot score jobs")

        profile_dict = {
            "name": profile.name or "",
            "skills": profile.skills or [],
            "experience": profile.experience or [],
            "education": profile.education or [],
            "tools": profile.tools or [],
            "domains": profile.domains or [],
        }

        # Get unscored jobs (limit 20 to stay within rate limits)
        result = await db.execute(
            select(Job)
            .where(Job.user_id == user_id, Job.match_score.is_(None))
            .order_by(Job.created_at.desc())
            .limit(20)
        )
        unscored = result.scalars().all()

        if not unscored:
            return self._ok({"scored": 0, "top_jobs": []})

        scored_count = 0
        for job in unscored:
            try:
                job_dict = {
                    "title": job.title,
                    "company": job.company,
                    "description": job.description or "",
                    "requirements": job.requirements or [],
                }
                score = await ai_service.score_job(profile_dict, job_dict)

                job.match_score = score.get("overall_score", 0)
                job.skill_match_pct = score.get("skill_match_pct", 0)
                job.experience_match = score.get("experience_match", 0)
                job.priority_score = score.get("priority_score", 0)
                scored_count += 1
            except Exception as e:
                logger.warning("Failed to score job %d: %s", job.id, e)
                continue

        await db.commit()

        # Return top 10 by score
        all_scored = sorted(unscored, key=lambda j: j.match_score or 0, reverse=True)
        top_jobs = [
            {"id": j.id, "title": j.title, "company": j.company, "score": j.match_score or 0}
            for j in all_scored[:10]
        ]

        return self._ok({"scored": scored_count, "top_jobs": top_jobs})
