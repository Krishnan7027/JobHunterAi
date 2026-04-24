"""Dashboard module service layer."""

import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.modules.jobs.models import Job
from app.modules.contacts.models import Contact


class DashboardService:
    """Aggregates stats from jobs and contacts."""

    async def _count_by_status(self, db: AsyncSession, user_id: int, status: str) -> int:
        return (await db.execute(
            select(func.count(Job.id)).where(Job.user_id == user_id, Job.status == status)
        )).scalar() or 0

    async def get_stats(self, db: AsyncSession, user_id: int) -> dict:
        """Get dashboard statistics scoped to a user."""
        total = (await db.execute(
            select(func.count(Job.id)).where(Job.user_id == user_id)
        )).scalar() or 0

        applied = await self._count_by_status(db, user_id, "applied")
        saved = await self._count_by_status(db, user_id, "saved")
        interview = await self._count_by_status(db, user_id, "interview")
        offer = await self._count_by_status(db, user_id, "offered")
        rejected = await self._count_by_status(db, user_id, "rejected")

        verified = (await db.execute(
            select(func.count(Contact.id)).where(Contact.user_id == user_id, Contact.verified == True)
        )).scalar() or 0

        avg_score = (await db.execute(
            select(func.avg(Job.match_score)).where(Job.user_id == user_id, Job.match_score.isnot(None))
        )).scalar() or 0

        return {
            "total_jobs": total,
            "applied_count": applied,
            "saved_count": saved,
            "interview_count": interview,
            "offer_count": offer,
            "rejected_count": rejected,
            "verified_contacts": verified,
            "avg_match_score": round(avg_score, 1),
            "top_skills_demanded": [],
        }

    async def get_analytics(self, db: AsyncSession, user_id: int) -> dict:
        """Get conversion analytics scoped to a user."""
        total = (await db.execute(
            select(func.count(Job.id)).where(Job.user_id == user_id)
        )).scalar() or 0

        applied = await self._count_by_status(db, user_id, "applied")
        saved = await self._count_by_status(db, user_id, "saved")
        interview = await self._count_by_status(db, user_id, "interview")
        offer = await self._count_by_status(db, user_id, "offered")
        rejected = await self._count_by_status(db, user_id, "rejected")

        # Total applications = applied + interview + offer + rejected
        total_applications = applied + interview + offer + rejected

        conversion_rate = round((interview / total_applications) * 100, 1) if total_applications > 0 else 0.0
        offer_rate = round((offer / total_applications) * 100, 1) if total_applications > 0 else 0.0

        avg_score = (await db.execute(
            select(func.avg(Job.match_score)).where(Job.user_id == user_id, Job.match_score.isnot(None))
        )).scalar() or 0

        return {
            "applications": total_applications,
            "interviews": interview,
            "offers": offer,
            "rejected": rejected,
            "saved": saved,
            "conversion_rate": conversion_rate,
            "offer_rate": offer_rate,
            "total_jobs": total,
            "avg_match_score": round(avg_score, 1),
            "pipeline": {
                "saved": saved,
                "applied": applied,
                "interview": interview,
                "offered": offer,
                "rejected": rejected,
            },
        }

    async def get_daily_actions(self, db: AsyncSession, user_id: int) -> dict:
        """Get daily recommended actions for user."""
        today = str(datetime.date.today())
        actions = []

        # Top unscored jobs to review
        unscored = await db.execute(
            select(Job).where(
                Job.user_id == user_id,
                Job.match_score.is_(None),
            ).limit(5)
        )
        unscored_jobs = unscored.scalars().all()
        if unscored_jobs:
            actions.append({
                "type": "score_jobs",
                "title": "Score new jobs",
                "description": f"{len(unscored_jobs)} jobs need AI scoring",
                "priority": "high",
            })

        # Jobs applied but no update in 5+ days → followup
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=5)
        stale_applied = await db.execute(
            select(Job).where(
                Job.user_id == user_id,
                Job.status == "applied",
                Job.applied_at.isnot(None),
                Job.applied_at < cutoff,
            ).limit(5)
        )
        stale_jobs = stale_applied.scalars().all()
        followup_needed = []
        for job in stale_jobs:
            days_ago = (datetime.datetime.utcnow() - job.applied_at).days if job.applied_at else 0
            followup_needed.append({
                "job_id": job.id,
                "title": job.title,
                "company": job.company,
                "applied_at": str(job.applied_at) if job.applied_at else None,
                "days_since_applied": days_ago,
            })
            actions.append({
                "type": "followup",
                "title": f"Follow up: {job.title}",
                "description": f"Applied {days_ago} days ago at {job.company}",
                "job_id": job.id,
                "job_title": job.title,
                "company": job.company,
                "priority": "high" if days_ago >= 7 else "medium",
            })

        # Top matched jobs to apply to
        top_result = await db.execute(
            select(Job).where(
                Job.user_id == user_id,
                Job.status.in_(["not_applied", "saved"]),
                Job.match_score.isnot(None),
            ).order_by(Job.match_score.desc()).limit(5)
        )
        top_jobs = top_result.scalars().all()
        for job in top_jobs:
            actions.append({
                "type": "apply",
                "title": f"Apply: {job.title}",
                "description": f"Match score {int(job.match_score or 0)}% at {job.company}",
                "job_id": job.id,
                "job_title": job.title,
                "company": job.company,
                "priority": "high" if (job.match_score or 0) >= 70 else "medium",
            })

        return {
            "date": today,
            "actions": actions,
            "top_jobs": [
                {
                    "id": j.id,
                    "title": j.title,
                    "company": j.company,
                    "match_score": j.match_score,
                    "status": j.status,
                }
                for j in top_jobs
            ],
            "followup_needed": followup_needed,
            "total_actions": len(actions),
        }


dashboard_service = DashboardService()
