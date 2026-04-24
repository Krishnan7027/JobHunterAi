"""Outreach Agent — generates outreach messages for recommended jobs."""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.agents.base import BaseAgent, AgentResult
from app.modules.profile.models import Profile
from app.modules.jobs.models import Job
from app.modules.ai.service import ai_service

logger = logging.getLogger(__name__)


class OutreachAgent(BaseAgent):
    name = "outreach"
    description = "Generate outreach messages for top recommended jobs"

    async def execute(self, db: AsyncSession, user_id: int, context: dict[str, Any]) -> AgentResult:
        jobs_to_apply = context.get("apply", [])
        if not jobs_to_apply:
            return self._skip("No jobs recommended for application")

        # Get profile for outreach personalization
        result = await db.execute(
            select(Profile).where(Profile.user_id == user_id).order_by(Profile.created_at.desc())
        )
        profile = result.scalar_one_or_none()
        if not profile:
            return self._skip("No profile — cannot generate personalized outreach")

        profile_dict = {
            "name": profile.name or "",
            "skills": profile.skills or [],
            "experience": profile.experience or [],
            "tools": profile.tools or [],
        }

        messages = []
        # Generate for top 3 to respect Gemini rate limits
        for job_ref in jobs_to_apply[:3]:
            job_id = job_ref.get("job_id")
            if not job_id:
                continue

            result = await db.execute(select(Job).where(Job.id == job_id, Job.user_id == user_id))
            job = result.scalar_one_or_none()
            if not job:
                continue

            job_dict = {
                "title": job.title,
                "company": job.company,
                "description": job.description or "",
            }

            try:
                email = await ai_service.generate_cold_email(profile_dict, job_dict)
                linkedin = await ai_service.generate_linkedin_message(profile_dict, job_dict)
                messages.append({
                    "job_id": job.id,
                    "title": job.title,
                    "company": job.company,
                    "cold_email": email,
                    "linkedin_message": linkedin,
                })
            except Exception as e:
                logger.warning("Outreach generation failed for job %d: %s", job.id, e)
                continue

        return self._ok({"messages": messages})
