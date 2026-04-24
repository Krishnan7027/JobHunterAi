import datetime
from collections import Counter
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import Profile, Job, SkillGap
from app.schemas import SkillGapOut

router = APIRouter()


@router.post("/skill-gaps/{profile_id}", response_model=list[SkillGapOut])
async def analyze_skill_gaps(profile_id: int, db: AsyncSession = Depends(get_db)):
    prof_result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = prof_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    jobs_result = await db.execute(select(Job).limit(100))
    jobs = jobs_result.scalars().all()

    all_requirements = []
    for job in jobs:
        all_requirements.extend(job.requirements or [])

    skill_counts = Counter(r.lower().strip() for r in all_requirements if r)
    user_skills = {s.lower().strip() for s in (profile.skills or [])}
    user_tools = {t.lower().strip() for t in (profile.tools or [])}
    user_all = user_skills | user_tools

    gaps = []
    for skill, count in skill_counts.most_common(20):
        if skill not in user_all:
            importance = "high" if count >= 5 else "medium" if count >= 2 else "low"
            gap = SkillGap(
                profile_id=profile.id,
                skill_name=skill,
                demand_count=count,
                importance=importance,
                learning_resources=[],
            )
            db.add(gap)
            gaps.append(gap)

    await db.commit()
    for g in gaps:
        await db.refresh(g)
    return gaps


@router.post("/interview-questions/{job_id}")
async def predict_interview_questions(
    job_id: int,
    profile_id: int = None,
    db: AsyncSession = Depends(get_db),
):
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    profile = None
    if profile_id:
        prof_result = await db.execute(select(Profile).where(Profile.id == profile_id))
        profile = prof_result.scalar_one_or_none()

    from app.services.ai.gemini_client import gemini_client

    prompt = gemini_client.load_prompt(
        "interview_questions",
        job_title=job.title,
        company=job.company,
        description=job.description or "",
        requirements=", ".join(job.requirements or []),
        skills=", ".join(profile.skills or []) if profile else "Not provided",
        experience=str(profile.experience or []) if profile else "Not provided",
    )

    result = await gemini_client.generate_json(prompt)
    return result or {
        "behavioral": [],
        "technical": [],
        "role_specific": [],
        "company_culture": [],
        "preparation_tips": [],
    }


@router.get("/hidden-jobs")
async def find_hidden_jobs(
    query: str = "software engineer",
    location: str = None,
    db: AsyncSession = Depends(get_db),
):
    from app.services.scraper.url_discovery import url_discovery

    hidden = await url_discovery.discover_hidden_jobs(query, location)

    created = []
    for raw in hidden:
        existing = await db.execute(
            select(Job).where(Job.apply_url == raw.get("apply_url", ""))
        )
        if existing.scalar_one_or_none():
            continue

        job = Job(
            title=raw.get("title", "Unknown"),
            company=raw.get("company", "Unknown"),
            location=raw.get("location"),
            description=raw.get("description"),
            apply_url=raw.get("apply_url", ""),
            source=raw.get("source", "company_career"),
            source_url=raw.get("source_url"),
            is_hidden_job=True,
        )
        db.add(job)
        created.append(job)

    await db.commit()
    return {
        "found": len(created),
        "jobs": [
            {"title": j.title, "company": j.company, "apply_url": j.apply_url}
            for j in created
        ],
    }


@router.get("/daily-digest")
async def daily_digest(profile_id: int = None, db: AsyncSession = Depends(get_db)):
    query = select(Job).where(
        Job.priority_score.isnot(None)
    ).order_by(Job.priority_score.desc()).limit(10)
    result = await db.execute(query)
    top_jobs = result.scalars().all()

    unscored_count = (await db.execute(
        select(func.count(Job.id)).where(Job.match_score.is_(None))
    )).scalar() or 0

    return {
        "date": str(datetime.date.today()),
        "top_matches": [
            {
                "id": j.id,
                "title": j.title,
                "company": j.company,
                "priority_score": j.priority_score,
                "status": j.status,
            }
            for j in top_jobs
        ],
        "total_unscored": unscored_count,
    }
