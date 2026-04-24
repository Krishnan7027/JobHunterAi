from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Profile, Job
from app.schemas import MatchRequest, MatchResult, SmartApplyRequest, SmartApplyResult

router = APIRouter()


@router.post("/score", response_model=list[MatchResult])
async def score_jobs(req: MatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.id == req.profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    if req.job_ids:
        jobs_result = await db.execute(select(Job).where(Job.id.in_(req.job_ids)))
    else:
        jobs_result = await db.execute(
            select(Job).where(Job.match_score.is_(None)).limit(50)
        )
    jobs = jobs_result.scalars().all()

    if not jobs:
        return []

    from app.services.matching_engine import matching_engine

    profile_dict = {
        "skills": profile.skills or [],
        "experience": profile.experience or [],
        "tools": profile.tools or [],
        "domains": profile.domains or [],
        "total_years_experience": sum(
            e.get("years", 0) for e in (profile.experience or [])
        ),
    }

    results = []
    for job in jobs:
        job_dict = {
            "title": job.title,
            "company": job.company,
            "description": job.description or "",
            "requirements": job.requirements or [],
        }
        score = await matching_engine.score_job(profile_dict, job_dict)

        job.match_score = score.get("overall_score", 0)
        job.skill_match_pct = score.get("skill_match_pct", 0)
        job.experience_match = score.get("experience_match", 0)
        job.priority_score = score.get("priority_score", 0)

        results.append(MatchResult(
            job_id=job.id,
            match_score=job.match_score,
            skill_match_pct=job.skill_match_pct,
            experience_match=job.experience_match,
            priority_score=job.priority_score,
            matched_skills=score.get("matched_skills", []),
            missing_skills=score.get("missing_skills", []),
        ))

    await db.commit()
    return results


@router.post("/smart-apply", response_model=SmartApplyResult)
async def smart_apply(req: SmartApplyRequest, db: AsyncSession = Depends(get_db)):
    prof_result = await db.execute(select(Profile).where(Profile.id == req.profile_id))
    profile = prof_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    job_result = await db.execute(select(Job).where(Job.id == req.job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    from app.services.ai.gemini_client import gemini_client

    cover_letter = await gemini_client.generate(
        gemini_client.load_prompt(
            "cover_letter",
            name=profile.name or "Candidate",
            skills=", ".join(profile.skills or []),
            experience=str(profile.experience or []),
            domains=", ".join(profile.domains or []),
            job_title=job.title,
            company=job.company,
            description=job.description or "",
        )
    )

    tailored_resume = await gemini_client.generate(
        gemini_client.load_prompt(
            "resume_tailor",
            resume_text=profile.raw_text or str(profile.skills),
            job_title=job.title,
            company=job.company,
            description=job.description or "",
            requirements=", ".join(job.requirements or []),
        )
    )

    return SmartApplyResult(
        tailored_resume=tailored_resume,
        cover_letter=cover_letter,
        is_easy_apply=job.is_easy_apply,
        application_answers={},
        recommended_channel="easy_apply" if job.is_easy_apply else "direct",
    )
