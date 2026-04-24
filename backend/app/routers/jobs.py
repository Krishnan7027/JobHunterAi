import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.database import get_db
from app.models import Job, User, Contact, job_contacts
from app.schemas import JobOut, JobFetchRequest, JobStatusUpdate, JobCreate
from app.auth import get_current_user

router = APIRouter()

# Valid platforms for filtering
VALID_PLATFORMS = {"linkedin", "indeed", "naukri", "google", "company", "glassdoor", "hidden", "other"}

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


@router.post("/fetch", response_model=list[JobOut])
async def fetch_jobs(
    req: JobFetchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scrape jobs and store under current user."""
    from app.services.scraper.url_discovery import url_discovery

    raw_jobs = await url_discovery.discover_all(
        role=req.query,
        location=req.location,
        sources=req.sources,
        max_results=req.max_results,
    )

    created_jobs = []
    for raw in raw_jobs:
        existing = await db.execute(
            select(Job).where(
                Job.apply_url == raw.get("apply_url", ""),
                Job.user_id == user.id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        platform = SOURCE_TO_PLATFORM.get(raw.get("source", "other"), "other")

        job = Job(
            user_id=user.id,
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
        created_jobs.append(job)

    await db.commit()
    for j in created_jobs:
        await db.refresh(j)
    return created_jobs


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
