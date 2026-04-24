"""Intelligence service — AI Coach, Strategy, Probability, Rejection, Evolution, Follow-up Timing."""

import datetime
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.modules.jobs.models import Job
from app.modules.profile.models import Profile
from app.modules.contacts.models import Contact
from app.modules.intelligence.models import ProfileEvolutionSnapshot
from app.modules.ai.gemini_client import gemini_client
from app.core.cache import cache_manager

logger = logging.getLogger(__name__)


class IntelligenceService:

    # ------------------------------------------------------------------
    # AI Job Coach
    # ------------------------------------------------------------------

    async def get_coach_insights(self, db: AsyncSession, user_id: int) -> dict:
        """Generate daily coaching insights based on user's profile and activity."""
        profile = await self._get_profile(db, user_id)
        stats = await self._get_user_stats(db, user_id)

        skills = ", ".join((profile.skills or [])[:10]) if profile else "No skills uploaded"
        total_apps = stats["applied"] + stats["interview"] + stats["offered"] + stats["rejected"]
        conv_rate = round((stats["interview"] / total_apps * 100), 1) if total_apps > 0 else 0

        prompt = f"""You are an AI career coach. Based on this job seeker's data, provide 3 actionable insights.

Profile: {skills}
Applications: {total_apps} total, {stats['interview']} interviews, {stats['offered']} offers
Conversion rate: {conv_rate}%
Saved jobs: {stats['saved']}
Rejected: {stats['rejected']}

Return JSON:
{{
  "insights": [
    {{"insight": "observation", "recommendation": "action", "category": "skills|applications|strategy|networking", "priority": "high|medium|low"}}
  ],
  "daily_summary": "one sentence summary of their job hunt status"
}}"""

        cache_key = cache_manager.hash_key("coach", str(user_id), str(datetime.date.today()))
        try:
            result = await gemini_client.generate_json(prompt, cache_key=cache_key)
            if isinstance(result, dict):
                return {
                    "insights": result.get("insights", []),
                    "daily_summary": result.get("daily_summary", ""),
                    "streak_days": await self._calc_streak(db, user_id),
                }
        except Exception as exc:
            logger.error("Coach insights failed: %s", exc)

        return {"insights": [], "daily_summary": "Upload your CV and apply to jobs to get personalized coaching.", "streak_days": 0}

    # ------------------------------------------------------------------
    # Application Strategy Engine
    # ------------------------------------------------------------------

    async def get_strategy(self, db: AsyncSession, user_id: int) -> dict:
        """Recommend which jobs to apply to and which to skip."""
        profile = await self._get_profile(db, user_id)
        if not profile or not profile.skills:
            return {"apply": [], "skip": [], "summary": "Upload CV to get strategy recommendations."}

        jobs_result = await db.execute(
            select(Job).where(
                Job.user_id == user_id,
                Job.status.in_(["not_applied", "saved"]),
            ).limit(20)
        )
        jobs = jobs_result.scalars().all()
        if not jobs:
            return {"apply": [], "skip": [], "summary": "No pending jobs to evaluate."}

        jobs_text = "\n".join(
            f"- ID:{j.id} | {j.title} at {j.company} | Score:{j.match_score or 'unscored'} | {j.location or 'Remote'}"
            for j in jobs
        )

        prompt = f"""You are a job application strategist. Based on this candidate's profile, decide which jobs to apply to and which to skip.

Skills: {', '.join(profile.skills[:10])}
Experience: {len(profile.experience or [])} roles
Domains: {', '.join(profile.domains or [])}

Jobs to evaluate:
{jobs_text}

Return JSON:
{{
  "apply": [{{"job_id": 1, "title": "", "company": "", "score": 85, "reason": "strong skill match"}}],
  "skip": [{{"job_id": 2, "title": "", "company": "", "score": 20, "reason": "no relevant experience"}}],
  "summary": "one line strategy summary"
}}"""

        try:
            result = await gemini_client.generate_json(prompt, max_tokens=2048)
            if isinstance(result, dict):
                return {
                    "apply": result.get("apply", []),
                    "skip": result.get("skip", []),
                    "summary": result.get("summary", ""),
                }
        except Exception as exc:
            logger.error("Strategy engine failed: %s", exc)

        return {"apply": [], "skip": [], "summary": "Strategy unavailable — try again later."}

    # ------------------------------------------------------------------
    # Interview Probability Score
    # ------------------------------------------------------------------

    async def predict_interview_probability(self, db: AsyncSession, user_id: int, job_ids: list[int] | None = None) -> list[dict]:
        """Predict interview probability for jobs based on profile match."""
        profile = await self._get_profile(db, user_id)
        if not profile or not profile.skills:
            return []

        if job_ids:
            jobs_result = await db.execute(
                select(Job).where(Job.id.in_(job_ids), Job.user_id == user_id)
            )
        else:
            jobs_result = await db.execute(
                select(Job).where(
                    Job.user_id == user_id,
                    Job.status.in_(["saved", "applied"]),
                ).limit(10)
            )
        jobs = jobs_result.scalars().all()
        if not jobs:
            return []

        jobs_text = "\n".join(
            f"- ID:{j.id} | {j.title} at {j.company} | Match:{j.match_score or 0}% | Desc:{(j.description or '')[:200]}"
            for j in jobs
        )

        prompt = f"""Predict interview probability (0-100) for each job based on candidate profile fit.

Candidate skills: {', '.join(profile.skills[:10])}
Experience: {len(profile.experience or [])} roles, domains: {', '.join(profile.domains or [])}

Jobs:
{jobs_text}

Return JSON:
{{
  "predictions": [
    {{"job_id": 1, "title": "", "company": "", "interview_probability": 72, "factors": ["strong Python match", "lacks cloud exp"], "recommendation": "Apply — good fit"}}
  ]
}}"""

        try:
            result = await gemini_client.generate_json(prompt, max_tokens=2048)
            if isinstance(result, dict):
                predictions = result.get("predictions", [])
                # Persist to job records
                for pred in predictions:
                    jid = pred.get("job_id")
                    prob = pred.get("interview_probability", 0)
                    for job in jobs:
                        if job.id == jid:
                            job.priority_score = prob
                            break
                await db.commit()
                return predictions
        except Exception as exc:
            logger.error("Interview probability failed: %s", exc)

        return []

    # ------------------------------------------------------------------
    # Rejection Analysis
    # ------------------------------------------------------------------

    async def analyze_rejection(self, db: AsyncSession, user_id: int, job_id: int) -> dict:
        """Analyze why a job application was rejected."""
        profile = await self._get_profile(db, user_id)
        job_result = await db.execute(
            select(Job).where(Job.id == job_id, Job.user_id == user_id)
        )
        job = job_result.scalar_one_or_none()
        if not job:
            return {"skill_gaps": [], "experience_mismatch": "", "possible_reasons": [], "improvement_actions": []}

        prompt = f"""Analyze why this job application may have been rejected.

Candidate skills: {', '.join((profile.skills or [])[:10]) if profile else 'Unknown'}
Candidate experience: {len(profile.experience or []) if profile else 0} roles

Job: {job.title} at {job.company}
Requirements: {', '.join(job.requirements or [])}
Description: {(job.description or '')[:500]}

Return JSON:
{{
  "job_id": {job.id},
  "title": "{job.title}",
  "company": "{job.company}",
  "skill_gaps": ["skill1", "skill2"],
  "experience_mismatch": "explanation of exp gap",
  "possible_reasons": ["reason1", "reason2"],
  "improvement_actions": ["action1", "action2"]
}}"""

        try:
            result = await gemini_client.generate_json(prompt)
            if isinstance(result, dict):
                return result
        except Exception as exc:
            logger.error("Rejection analysis failed: %s", exc)

        return {
            "job_id": job.id, "title": job.title, "company": job.company,
            "skill_gaps": [], "experience_mismatch": "Analysis unavailable",
            "possible_reasons": [], "improvement_actions": [],
        }

    # ------------------------------------------------------------------
    # Smart Follow-up Timing
    # ------------------------------------------------------------------

    async def get_followup_timing(self, db: AsyncSession, user_id: int) -> list[dict]:
        """Recommend optimal follow-up timing for applied jobs."""
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=3)
        result = await db.execute(
            select(Job).where(
                Job.user_id == user_id,
                Job.status == "applied",
                Job.applied_at.isnot(None),
                Job.applied_at < cutoff,
            ).order_by(Job.applied_at.asc()).limit(10)
        )
        jobs = result.scalars().all()
        if not jobs:
            return []

        followups = []
        now = datetime.datetime.utcnow()
        for job in jobs:
            days = (now - job.applied_at).days if job.applied_at else 0

            if days >= 14:
                urgency = "high"
                action = "Send final follow-up — last chance before moving on"
                tone = "direct but professional"
                optimal = "Today"
            elif days >= 7:
                urgency = "high"
                action = "Send follow-up — enough time has passed"
                tone = "warm and value-adding"
                optimal = "Today or tomorrow"
            elif days >= 5:
                urgency = "medium"
                action = "Prepare follow-up — send in 2 days"
                tone = "brief check-in"
                optimal = f"In {7 - days} days"
            else:
                urgency = "low"
                action = "Too early — wait a few more days"
                tone = "patient"
                optimal = f"In {7 - days} days"

            followups.append({
                "job_id": job.id,
                "title": job.title,
                "company": job.company,
                "days_since_applied": days,
                "recommended_action": action,
                "optimal_day": optimal,
                "urgency": urgency,
                "message_tone": tone,
            })

        return followups

    # ------------------------------------------------------------------
    # Profile Evolution
    # ------------------------------------------------------------------

    async def take_snapshot(self, db: AsyncSession, user_id: int) -> dict:
        """Take a snapshot of current profile state for evolution tracking."""
        profile = await self._get_profile(db, user_id)
        stats = await self._get_user_stats(db, user_id)
        total_apps = stats["applied"] + stats["interview"] + stats["offered"] + stats["rejected"]

        snapshot = ProfileEvolutionSnapshot(
            user_id=user_id,
            skills_count=len(profile.skills or []) if profile else 0,
            avg_match_score=stats.get("avg_score", 0),
            total_applications=total_apps,
            interviews=stats["interview"],
            offers=stats["offered"],
            conversion_rate=round((stats["interview"] / total_apps * 100), 1) if total_apps > 0 else 0,
            top_skills=(profile.skills or [])[:10] if profile else [],
        )
        db.add(snapshot)
        await db.commit()
        await db.refresh(snapshot)
        return {"id": snapshot.id, "created_at": str(snapshot.created_at)}

    async def get_evolution(self, db: AsyncSession, user_id: int) -> dict:
        """Get profile evolution data — snapshots + trends."""
        result = await db.execute(
            select(ProfileEvolutionSnapshot)
            .where(ProfileEvolutionSnapshot.user_id == user_id)
            .order_by(ProfileEvolutionSnapshot.created_at.asc())
        )
        snapshots = result.scalars().all()

        if not snapshots:
            # Auto-take first snapshot
            await self.take_snapshot(db, user_id)
            result = await db.execute(
                select(ProfileEvolutionSnapshot)
                .where(ProfileEvolutionSnapshot.user_id == user_id)
                .order_by(ProfileEvolutionSnapshot.created_at.asc())
            )
            snapshots = result.scalars().all()

        score_trend = [
            {"date": str(s.created_at.date()), "score": s.avg_match_score, "apps": s.total_applications}
            for s in snapshots
        ]

        application_trend = [
            {"date": str(s.created_at.date()), "total": s.total_applications, "interviews": s.interviews, "offers": s.offers}
            for s in snapshots
        ]

        # Skill growth: compare first vs last
        skill_growth = {}
        if len(snapshots) >= 2:
            first_skills = set(snapshots[0].top_skills or [])
            last_skills = set(snapshots[-1].top_skills or [])
            skill_growth = {
                "added": list(last_skills - first_skills),
                "maintained": list(first_skills & last_skills),
                "first_count": snapshots[0].skills_count,
                "current_count": snapshots[-1].skills_count,
                "growth": snapshots[-1].skills_count - snapshots[0].skills_count,
            }

        summary = ""
        if len(snapshots) >= 2:
            first, last = snapshots[0], snapshots[-1]
            score_diff = last.avg_match_score - first.avg_match_score
            app_diff = last.total_applications - first.total_applications
            summary = f"Since {first.created_at.date()}: match score {'improved' if score_diff > 0 else 'unchanged'} ({score_diff:+.1f}%), {app_diff} new applications."

        return {
            "snapshots": snapshots,
            "skill_growth": skill_growth,
            "score_trend": score_trend,
            "application_trend": application_trend,
            "summary": summary,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_profile(self, db: AsyncSession, user_id: int) -> Profile | None:
        result = await db.execute(
            select(Profile).where(Profile.user_id == user_id).order_by(Profile.created_at.desc())
        )
        return result.scalar_one_or_none()

    async def _get_user_stats(self, db: AsyncSession, user_id: int) -> dict:
        counts = {}
        for status in ["saved", "applied", "interview", "offered", "rejected"]:
            val = (await db.execute(
                select(func.count(Job.id)).where(Job.user_id == user_id, Job.status == status)
            )).scalar() or 0
            counts[status] = val

        avg_score = (await db.execute(
            select(func.avg(Job.match_score)).where(Job.user_id == user_id, Job.match_score.isnot(None))
        )).scalar() or 0
        counts["avg_score"] = round(avg_score, 1)

        return counts

    async def _calc_streak(self, db: AsyncSession, user_id: int) -> int:
        """Calculate consecutive days with activity."""
        result = await db.execute(
            select(Job.applied_at).where(
                Job.user_id == user_id,
                Job.applied_at.isnot(None),
            ).order_by(Job.applied_at.desc()).limit(30)
        )
        dates = [r[0].date() for r in result.fetchall() if r[0]]
        if not dates:
            return 0

        streak = 0
        check_date = datetime.date.today()
        unique_dates = sorted(set(dates), reverse=True)
        for d in unique_dates:
            if d == check_date or d == check_date - datetime.timedelta(days=1):
                streak += 1
                check_date = d
            else:
                break
        return streak


intelligence_service = IntelligenceService()
