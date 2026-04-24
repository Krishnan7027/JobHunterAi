"""Jobs module routes (JWT-protected)."""

import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.models import User
from app.modules.jobs.models import Job, Application, job_contacts
from pydantic import BaseModel
from app.modules.jobs.schemas import JobOut, JobFetchRequest, JobStatusUpdate, JobCreate
from app.modules.jobs.service import job_service, SOURCE_TO_PLATFORM, VALID_PLATFORMS
from app.modules.contacts.models import Contact

router = APIRouter()


@router.post("/fetch")
async def fetch_jobs(
    req: JobFetchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scrape jobs via dual-layer orchestrator and store under current user.

    Uses Playwright for Indeed/Naukri, httpx for Google, with automatic fallback.
    Never returns empty — always falls back to Google search.
    """
    from app.modules.scraper.job_orchestrator import get_jobs

    raw_jobs, source_used = await get_jobs(
        query=req.query,
        location=req.location,
        sources=req.sources,
        max_results=req.max_results,
    )

    created_jobs = []
    for raw in raw_jobs:
        job = await job_service.create_job_from_raw(db, user.id, raw)
        if job:
            created_jobs.append(job)

    await db.commit()
    for j in created_jobs:
        await db.refresh(j)

    return {
        "jobs": [JobOut.model_validate(j) for j in created_jobs],
        "source": source_used,
        "total": len(created_jobs),
        "query": req.query,
        "location": req.location,
    }


@router.post("/rank")
async def rank_user_jobs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rank all unscored jobs against user's profile using Gemini AI.

    Returns jobs sorted by match score (best first).
    """
    from app.modules.profile.models import Profile
    from app.modules.ai.job_ranker import rank_jobs

    # Get user profile
    profile_result = await db.execute(
        select(Profile).where(Profile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile or not profile.skills:
        return {"error": "Upload CV first to enable AI ranking", "jobs": []}

    profile_dict = {
        "skills": profile.skills or [],
        "experience": profile.experience or [],
        "domains": profile.domains or [],
    }

    # Get unscored jobs
    jobs_result = await db.execute(
        select(Job).where(
            Job.user_id == user.id,
            Job.match_score.is_(None),
        ).limit(20)
    )
    jobs_list = jobs_result.scalars().all()

    if not jobs_list:
        return {"message": "No unscored jobs found", "jobs": []}

    # Build job dicts for ranking
    job_dicts = [
        {
            "id": j.id,
            "title": j.title,
            "company": j.company,
            "description": j.description or "",
            "location": j.location or "",
        }
        for j in jobs_list
    ]

    # Rank with AI
    ranked = await rank_jobs(profile_dict, job_dicts)

    # Persist scores to DB
    for ranked_job in ranked:
        job_id = ranked_job.get("id")
        if not job_id:
            continue
        for db_job in jobs_list:
            if db_job.id == job_id:
                db_job.match_score = ranked_job.get("score", 0)
                db_job.priority_score = ranked_job.get("score", 0)
                break

    await db.commit()

    return {
        "ranked": len(ranked),
        "jobs": [
            {
                "id": r.get("id"),
                "title": r.get("title"),
                "company": r.get("company"),
                "score": r.get("score", 0),
                "relevance": r.get("relevance", "low"),
                "matched_skills": r.get("matched_skills", []),
                "missing_skills": r.get("missing_skills", []),
                "reason": r.get("reason", ""),
            }
            for r in ranked
        ],
    }


@router.post("/", response_model=JobOut)
async def create_job(
    job_data: JobCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually create a job for current user."""
    data = job_data.model_dump()
    data["user_id"] = user.id
    # Map source to platform
    if "source" in data:
        data["platform"] = SOURCE_TO_PLATFORM.get(data.pop("source", "other"), "other")
    job = Job(**data)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


class ApplyRequest(BaseModel):
    job_id: int


@router.post("/apply")
async def apply_to_job(
    req: ApplyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Track job application. Opens apply URL on frontend, records in DB.

    Prevents duplicate applications.
    """
    # Verify job belongs to user
    job_result = await db.execute(
        select(Job).where(Job.id == req.job_id, Job.user_id == user.id)
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    # Check for duplicate application
    existing = await db.execute(
        select(Application).where(
            Application.job_id == req.job_id,
            Application.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        return {"status": "already_applied", "apply_url": job.apply_url, "message": "Already applied to this job"}

    # Create application record
    from app.modules.profile.models import Profile
    profile_result = await db.execute(
        select(Profile).where(Profile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()

    application = Application(
        user_id=user.id,
        job_id=job.id,
        profile_id=profile.id if profile else 0,
        status="applied",
    )
    db.add(application)

    # Update job status
    job.status = "applied"
    job.applied_at = datetime.datetime.utcnow()

    await db.commit()

    return {
        "status": "applied",
        "apply_url": job.apply_url,
        "job_title": job.title,
        "company": job.company,
        "message": f"Application tracked for {job.title} at {job.company}",
    }


@router.get("/", response_model=list[JobOut])
async def list_jobs(
    platform: Optional[str] = Query(None, description="Filter by platform(s), comma-separated: linkedin,naukri,indeed"),
    status: str = Query(None),
    min_score: float = Query(None),
    sort_by: str = Query("created_at"),
    limit: int = Query(50),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List jobs for current user with platform filtering."""
    query = select(Job).where(Job.user_id == user.id)

    # Platform filter: supports comma-separated values
    if platform:
        platforms = [p.strip().lower() for p in platform.split(",")]
        valid = [p for p in platforms if p in VALID_PLATFORMS]
        if valid:
            query = query.where(Job.platform.in_(valid))

    if status:
        query = query.where(Job.status == status)
    if min_score is not None:
        query = query.where(Job.priority_score >= min_score)

    if sort_by == "priority_score":
        query = query.order_by(Job.priority_score.desc().nullslast())
    elif sort_by == "match_score":
        query = query.order_by(Job.match_score.desc().nullslast())
    else:
        query = query.order_by(Job.created_at.desc())

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{job_id}", response_model=JobOut)
async def get_job(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/{job_id}/contacts")
async def get_job_contacts(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get verified contacts for a user's job."""
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Job not found")

    contacts_result = await db.execute(
        select(Contact)
        .join(job_contacts, Contact.id == job_contacts.c.contact_id)
        .where(job_contacts.c.job_id == job_id)
    )
    contacts = contacts_result.scalars().all()

    return [
        {
            "id": c.id, "name": c.name, "role": c.role,
            "company": c.company, "email": c.email,
            "profile_url": c.profile_url, "source_url": c.source_url,
            "extraction_type": c.extraction_type, "verified": c.verified,
        }
        for c in contacts
    ]


@router.patch("/{job_id}/status", response_model=JobOut)
async def update_job_status(
    job_id: int,
    update: JobStatusUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    job.status = update.status
    if update.notes:
        job.notes = update.notes
    if update.status == "applied":
        job.applied_at = datetime.datetime.utcnow()

    await db.commit()
    await db.refresh(job)
    return job


@router.delete("/{job_id}")
async def delete_job(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")
    await db.delete(job)
    await db.commit()
    return {"status": "deleted"}
