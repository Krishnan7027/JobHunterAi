"""Jobs module service layer."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.jobs.models import Job

# Map scraper source names to platform values
SOURCE_TO_PLATFORM = {
    "google": "google",
    "linkedin": "linkedin",
    "indeed": "indeed",
    "naukri": "naukri",
    "glassdoor": "glassdoor",
    "company_career": "company",
    "hidden_job": "hidden",
    "other": "other",
}

# Valid platforms for filtering
VALID_PLATFORMS = {"linkedin", "indeed", "naukri", "google", "company", "glassdoor", "hidden", "other"}


class JobService:
    """Service layer for job operations."""

    async def create_job_from_raw(
        self, db: AsyncSession, user_id: int, raw: dict
    ) -> Job | None:
        """Create a job from raw scraper data, skipping duplicates.

        Returns the created Job or None if duplicate.
        """
        existing = await db.execute(
            select(Job).where(
                Job.apply_url == raw.get("apply_url", ""),
                Job.user_id == user_id,
            )
        )
        if existing.scalar_one_or_none():
            return None

        platform = SOURCE_TO_PLATFORM.get(raw.get("source", "other"), "other")

        job = Job(
            user_id=user_id,
            title=raw.get("title", "Unknown"),
            company=raw.get("company", "Unknown"),
            location=raw.get("location"),
            description=raw.get("description"),
            requirements=raw.get("requirements", []),
            salary_range=raw.get("salary_range"),
            apply_url=raw.get("apply_url", ""),
            platform=platform,
            source_url=raw.get("source_url"),
            is_easy_apply=raw.get("is_easy_apply", False),
            is_hidden_job=raw.get("is_hidden_job", False),
            posted_date=raw.get("posted_date"),
        )
        db.add(job)
        return job


job_service = JobService()
