"""AI module routes — three routers in one file.

ai_router       — CV parsing, job matching, content generation, outreach
matching_router — batch scoring, smart apply
advanced_router — skill gaps, interview questions, hidden jobs, daily digest
"""

import datetime
import os
from collections import Counter

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.models import User

from app.modules.profile.models import Profile, SkillGap
from app.modules.jobs.models import Job
from app.modules.contacts.models import Contact

from app.modules.ai.service import ai_service
from app.modules.ai.gemini_client import gemini_client
from app.modules.ai.schemas import (
    ParseCVResponse,
    MatchJobRequest,
    MatchJobResponse,
    CoverLetterRequest,
    CoverLetterResponse,
    ApplicationAnswersRequest,
    ApplicationAnswerItem,
    ApplicationAnswersResponse,
    ColdEmailRequest,
    EmailResponse,
    FollowupEmailRequest,
    LinkedInMessageRequest,
    LinkedInMessageResponse,
    MatchRequest,
    MatchResult,
    SmartApplyRequest,
    SmartApplyResult,
    SkillGapOut,
    ProfileAnalysisRequest,
    ProfileAnalysisResponse,
    PrepareApplicationRequest,
    PrepareApplicationResponse,
    GenerateOutreachRequest,
    GenerateOutreachResponse,
    AutoFollowupRequest,
    AutoFollowupResponse,
)


# ---------------------------------------------------------------------------
# Helpers (shared across routers)
# ---------------------------------------------------------------------------

def _profile_dict(profile: Profile) -> dict:
    return {
        "name": profile.name or "Candidate",
        "skills": profile.skills or [],
        "experience": profile.experience or [],
        "domains": profile.domains or [],
        "raw_text": profile.raw_text or "",
    }


def _job_dict(job: Job) -> dict:
    return {
        "title": job.title,
        "company": job.company,
        "description": job.description or "",
        "requirements": job.requirements or [],
    }


def _contact_dict(contact: Contact | None) -> dict | None:
    if not contact:
        return None
    return {
        "name": contact.name,
        "role": contact.role,
        "company": contact.company,
        "email": contact.email,
    }


async def _load_profile_job_contact(
    db: AsyncSession, user: User, profile_id: int, job_id: int, contact_id: int | None = None
):
    """Load and validate profile, job, optional contact -- all user-scoped."""
    profile_result = await db.execute(
        select(Profile).where(Profile.id == profile_id, Profile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    job_result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    contact = None
    if contact_id:
        contact_result = await db.execute(
            select(Contact).where(Contact.id == contact_id, Contact.user_id == user.id)
        )
        contact = contact_result.scalar_one_or_none()

    return profile, job, contact


# ===================================================================
# 1. AI ROUTER — from routers/ai.py
# ===================================================================

ai_router = APIRouter()


@ai_router.post("/parse-cv", response_model=ParseCVResponse)
async def parse_cv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Parse a CV file and return structured data.

    Accepts PDF or DOCX. Results cached by file content hash.
    """
    if not file.filename:
        raise HTTPException(400, "No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".pdf", ".docx", ".doc"):
        raise HTTPException(400, "Only PDF and DOCX files supported")

    os.makedirs(settings.upload_dir, exist_ok=True)
    file_path = os.path.join(settings.upload_dir, file.filename)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    parsed = await ai_service.parse_cv(file_path)

    return ParseCVResponse(
        name=parsed.get("name", ""),
        email=parsed.get("email", ""),
        phone=parsed.get("phone", ""),
        summary=parsed.get("summary", ""),
        skills=parsed.get("skills", []),
        experience=parsed.get("experience", []),
        education=parsed.get("education", []),
        tools=parsed.get("tools", []),
        domains=parsed.get("domains", []),
        total_years_experience=parsed.get("total_years_experience", 0),
    )


@ai_router.post("/match-job", response_model=MatchJobResponse)
async def match_job(req: MatchJobRequest, db: AsyncSession = Depends(get_db)):
    """Score how well a profile matches a job. Uses Gemini AI with caching."""
    profile_result = await db.execute(select(Profile).where(Profile.id == req.profile_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    job_result = await db.execute(select(Job).where(Job.id == req.job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    profile_dict = {
        "skills": profile.skills or [],
        "tools": profile.tools or [],
        "domains": profile.domains or [],
        "total_years_experience": sum(
            e.get("years", 0) for e in (profile.experience or [])
        ),
    }
    job_dict = {
        "title": job.title,
        "company": job.company,
        "description": job.description or "",
        "requirements": job.requirements or [],
    }

    score = await ai_service.score_job(profile_dict, job_dict)

    # Persist score to job
    job.match_score = score.get("overall_score", 0)
    job.skill_match_pct = score.get("skill_match_pct", 0)
    job.experience_match = score.get("experience_match", 0)
    job.priority_score = score.get("priority_score", 0)
    await db.commit()

    return MatchJobResponse(
        score=score.get("overall_score", 0),
        skill_match_pct=score.get("skill_match_pct", 0),
        experience_match=score.get("experience_match", 0),
        matched_skills=score.get("matched_skills", []),
        missing_skills=score.get("missing_skills", []),
        reasoning=score.get("reasoning", ""),
    )


@ai_router.post("/generate-cover-letter", response_model=CoverLetterResponse)
async def generate_cover_letter(
    req: CoverLetterRequest, db: AsyncSession = Depends(get_db)
):
    """Generate a tailored cover letter for a specific job."""
    profile_result = await db.execute(select(Profile).where(Profile.id == req.profile_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    job_result = await db.execute(select(Job).where(Job.id == req.job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    cover_letter = await ai_service.generate_cover_letter(
        _profile_dict(profile), _job_dict(job)
    )
    if not cover_letter:
        raise HTTPException(500, "Failed to generate cover letter")

    return CoverLetterResponse(cover_letter=cover_letter)


@ai_router.post("/generate-answers", response_model=ApplicationAnswersResponse)
async def generate_application_answers(
    req: ApplicationAnswersRequest, db: AsyncSession = Depends(get_db)
):
    """Generate answers to application questions based on profile and job."""
    if not req.questions:
        raise HTTPException(400, "At least one question required")

    profile_result = await db.execute(select(Profile).where(Profile.id == req.profile_id))
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    job_result = await db.execute(select(Job).where(Job.id == req.job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    profile_dict = {
        "name": profile.name or "Candidate",
        "skills": profile.skills or [],
        "experience": profile.experience or [],
        "domains": profile.domains or [],
    }
    job_dict = {
        "title": job.title,
        "company": job.company,
        "description": job.description or "",
    }

    answers = await ai_service.generate_application_answers(
        profile_dict, job_dict, req.questions
    )

    return ApplicationAnswersResponse(
        answers=[ApplicationAnswerItem(**a) for a in answers if a.get("question")]
    )


@ai_router.post("/generate-cold-email", response_model=EmailResponse)
async def generate_cold_email(
    req: ColdEmailRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate high-conversion cold email personalized to profile + job."""
    profile, job, contact = await _load_profile_job_contact(
        db, user, req.profile_id, req.job_id, req.contact_id
    )

    result = await ai_service.generate_cold_email(
        _profile_dict(profile), _job_dict(job), _contact_dict(contact)
    )

    if not result:
        raise HTTPException(500, "Failed to generate cold email")

    return EmailResponse(**result)


@ai_router.post("/generate-followup", response_model=EmailResponse)
async def generate_followup_email(
    req: FollowupEmailRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate follow-up email. Short, adds new value, zero desperation."""
    profile, job, contact = await _load_profile_job_contact(
        db, user, req.profile_id, req.job_id, req.contact_id
    )

    result = await ai_service.generate_followup_email(
        _profile_dict(profile), _job_dict(job), _contact_dict(contact),
        previous_date=req.previous_date,
        new_value=req.new_value,
    )

    if not result:
        raise HTTPException(500, "Failed to generate follow-up")

    return EmailResponse(**result)


@ai_router.post("/generate-linkedin-message", response_model=LinkedInMessageResponse)
async def generate_linkedin_message(
    req: LinkedInMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate LinkedIn connection message. Under 50 words, high accept rate."""
    profile, job, contact = await _load_profile_job_contact(
        db, user, req.profile_id, req.job_id, req.contact_id
    )

    message = await ai_service.generate_linkedin_message(
        _profile_dict(profile), _job_dict(job), _contact_dict(contact),
        connection_context=req.connection_context,
    )

    if not message:
        raise HTTPException(500, "Failed to generate LinkedIn message")

    return LinkedInMessageResponse(message=message)


@ai_router.post("/analyze-profile", response_model=ProfileAnalysisResponse)
async def analyze_profile(
    req: ProfileAnalysisRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze a user's profile — strengths, weaknesses, skill gaps, role recommendations."""
    profile_result = await db.execute(
        select(Profile).where(Profile.id == req.profile_id, Profile.user_id == user.id)
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    profile_dict = {
        "name": profile.name or "Candidate",
        "skills": profile.skills or [],
        "tools": profile.tools or [],
        "domains": profile.domains or [],
        "experience": profile.experience or [],
        "education": profile.education or [],
    }

    result = await ai_service.analyze_profile(profile_dict)
    return ProfileAnalysisResponse(**result)


@ai_router.post("/prepare-application", response_model=PrepareApplicationResponse)
async def prepare_application(
    req: PrepareApplicationRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-Apply Assistant: prepare resume, cover letter, and answers for a job.

    Does NOT apply — user clicks apply manually. Safe mode only.
    """
    job_result = await db.execute(
        select(Job).where(Job.id == req.job_id, Job.user_id == user.id)
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    # Find profile
    if req.profile_id:
        profile_result = await db.execute(
            select(Profile).where(Profile.id == req.profile_id, Profile.user_id == user.id)
        )
    else:
        profile_result = await db.execute(
            select(Profile).where(Profile.user_id == user.id)
        )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found — upload CV first")

    p = _profile_dict(profile)
    j = _job_dict(job)

    # Generate resume + cover letter concurrently
    import asyncio
    resume_task = ai_service.generate_tailored_resume(p, j)
    cover_task = ai_service.generate_cover_letter(p, j)

    results = await asyncio.gather(resume_task, cover_task, return_exceptions=True)
    tailored_resume = results[0] if not isinstance(results[0], Exception) else ""
    cover_letter = results[1] if not isinstance(results[1], Exception) else ""

    # Generate answers if questions provided
    answers = []
    if req.questions:
        raw_answers = await ai_service.generate_application_answers(p, j, req.questions)
        answers = [ApplicationAnswerItem(**a) for a in raw_answers if a.get("question")]

    return PrepareApplicationResponse(
        tailored_resume=tailored_resume,
        cover_letter=cover_letter,
        answers=answers,
        is_easy_apply=job.is_easy_apply,
        apply_url=job.apply_url,
        job_title=job.title,
        company=job.company,
    )


@ai_router.post("/generate-outreach", response_model=GenerateOutreachResponse)
async def generate_outreach_bundle(
    req: GenerateOutreachRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate all outreach types at once: cold email, LinkedIn message, followup."""
    job_result = await db.execute(
        select(Job).where(Job.id == req.job_id, Job.user_id == user.id)
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    if req.profile_id:
        profile_result = await db.execute(
            select(Profile).where(Profile.id == req.profile_id, Profile.user_id == user.id)
        )
    else:
        profile_result = await db.execute(
            select(Profile).where(Profile.user_id == user.id)
        )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    contact = None
    if req.contact_id:
        contact_result = await db.execute(
            select(Contact).where(Contact.id == req.contact_id, Contact.user_id == user.id)
        )
        contact = contact_result.scalar_one_or_none()

    p = _profile_dict(profile)
    j = _job_dict(job)
    c = _contact_dict(contact)

    import asyncio
    cold_task = ai_service.generate_cold_email(p, j, c)
    linkedin_task = ai_service.generate_linkedin_message(p, j, c)
    followup_task = ai_service.generate_followup_email(p, j, c)

    results = await asyncio.gather(cold_task, linkedin_task, followup_task, return_exceptions=True)

    cold_email = None
    if not isinstance(results[0], Exception) and results[0]:
        cold_email = EmailResponse(**results[0])

    linkedin_msg = ""
    if not isinstance(results[1], Exception):
        linkedin_msg = results[1] or ""

    followup_email = None
    if not isinstance(results[2], Exception) and results[2]:
        followup_email = EmailResponse(**results[2])

    return GenerateOutreachResponse(
        cold_email=cold_email,
        linkedin_message=linkedin_msg,
        followup_email=followup_email,
    )


@ai_router.post("/generate-auto-followup", response_model=AutoFollowupResponse)
async def generate_auto_followup(
    req: AutoFollowupRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate follow-up for a job applied X days ago with no response."""
    job_result = await db.execute(
        select(Job).where(Job.id == req.job_id, Job.user_id == user.id)
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    days = req.days_since_applied
    if job.applied_at:
        days = (datetime.datetime.utcnow() - job.applied_at).days

    if req.profile_id:
        profile_result = await db.execute(
            select(Profile).where(Profile.id == req.profile_id, Profile.user_id == user.id)
        )
    else:
        profile_result = await db.execute(
            select(Profile).where(Profile.user_id == user.id)
        )
    profile = profile_result.scalar_one_or_none()

    p = _profile_dict(profile) if profile else {"name": "Candidate", "skills": [], "experience": [], "domains": [], "raw_text": ""}
    j = _job_dict(job)

    result = await ai_service.generate_followup_email(
        p, j,
        previous_date=f"{days} days ago",
        new_value="",
    )

    return AutoFollowupResponse(
        subject=result.get("subject", f"Re: {job.title}"),
        body=result.get("body", ""),
        job_title=job.title,
        company=job.company,
        days_waiting=days,
    )


# ===================================================================
# 2. MATCHING ROUTER — from routers/matching.py
# ===================================================================

matching_router = APIRouter()


@matching_router.post("/score", response_model=list[MatchResult])
async def score_jobs(
    req: MatchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Auto-find user's profile if profile_id not provided or doesn't match
    if req.profile_id:
        result = await db.execute(
            select(Profile).where(Profile.id == req.profile_id, Profile.user_id == user.id)
        )
    else:
        result = await db.execute(
            select(Profile).where(Profile.user_id == user.id)
        )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Please upload your CV in the CV Profile section to enable job scoring.")
    if not profile.skills:
        raise HTTPException(400, "Please re-upload your CV or update your profile with skills.")

    if req.job_ids:
        jobs_result = await db.execute(
            select(Job).where(Job.id.in_(req.job_ids), Job.user_id == user.id)
        )
    else:
        jobs_result = await db.execute(
            select(Job).where(Job.user_id == user.id, Job.match_score.is_(None)).limit(50)
        )
    jobs = jobs_result.scalars().all()

    if not jobs:
        return []

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
        score = await ai_service.score_job(profile_dict, job_dict)

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


@matching_router.post("/smart-apply", response_model=SmartApplyResult)
async def smart_apply(req: SmartApplyRequest, db: AsyncSession = Depends(get_db)):
    prof_result = await db.execute(select(Profile).where(Profile.id == req.profile_id))
    profile = prof_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")

    job_result = await db.execute(select(Job).where(Job.id == req.job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

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


# ===================================================================
# 3. ADVANCED ROUTER — from routers/advanced.py
# ===================================================================

advanced_router = APIRouter()


@advanced_router.post("/skill-gaps/{profile_id}", response_model=list[SkillGapOut])
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


@advanced_router.post("/interview-questions/{job_id}")
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


@advanced_router.get("/hidden-jobs")
async def find_hidden_jobs(
    query: str = "software engineer",
    location: str = None,
    db: AsyncSession = Depends(get_db),
):
    from app.modules.scraper.url_discovery import url_discovery

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


@advanced_router.get("/daily-digest")
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
