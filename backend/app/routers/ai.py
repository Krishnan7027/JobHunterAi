"""Dedicated AI endpoints for CV parsing, job matching, and content generation."""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import os
import aiofiles

from app.database import get_db
from app.models import Profile, Job, Contact, User
from app.config import settings
from app.auth import get_current_user

router = APIRouter()


# --- Request/Response schemas ---

class ParseCVResponse(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    summary: str = ""
    skills: list[str] = []
    experience: list[dict] = []
    education: list[dict] = []
    tools: list[str] = []
    domains: list[str] = []
    total_years_experience: float = 0


class MatchJobRequest(BaseModel):
    profile_id: int
    job_id: int


class MatchJobResponse(BaseModel):
    score: float
    skill_match_pct: float
    experience_match: float
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    reasoning: str = ""


class CoverLetterRequest(BaseModel):
    profile_id: int
    job_id: int


class CoverLetterResponse(BaseModel):
    cover_letter: str


class ApplicationAnswersRequest(BaseModel):
    profile_id: int
    job_id: int
    questions: list[str]


class ApplicationAnswerItem(BaseModel):
    question: str
    answer: str


class ApplicationAnswersResponse(BaseModel):
    answers: list[ApplicationAnswerItem] = []


# --- Endpoints ---

@router.post("/parse-cv", response_model=ParseCVResponse)
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

    from app.services.cv_parser import parse_cv as do_parse
    parsed = await do_parse(file_path)

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


@router.post("/match-job", response_model=MatchJobResponse)
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

    from app.services.matching_engine import matching_engine

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

    score = await matching_engine.score_job(profile_dict, job_dict)

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


@router.post("/generate-cover-letter", response_model=CoverLetterResponse)
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

    from app.services.ai.content_generator import content_generator

    profile_dict = {
        "name": profile.name or "Candidate",
        "skills": profile.skills or [],
        "experience": profile.experience or [],
        "domains": profile.domains or [],
        "raw_text": profile.raw_text or "",
    }
    job_dict = {
        "title": job.title,
        "company": job.company,
        "description": job.description or "",
        "requirements": job.requirements or [],
    }

    cover_letter = await content_generator.generate_cover_letter(profile_dict, job_dict)
    if not cover_letter:
        raise HTTPException(500, "Failed to generate cover letter")

    return CoverLetterResponse(cover_letter=cover_letter)


@router.post("/generate-answers", response_model=ApplicationAnswersResponse)
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

    from app.services.ai.content_generator import content_generator

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

    answers = await content_generator.generate_application_answers(
        profile_dict, job_dict, req.questions
    )

    return ApplicationAnswersResponse(
        answers=[ApplicationAnswerItem(**a) for a in answers if a.get("question")]
    )


# --- Outreach generation schemas ---

class ColdEmailRequest(BaseModel):
    profile_id: int
    job_id: int
    contact_id: Optional[int] = None


class EmailResponse(BaseModel):
    subject: str
    body: str


class FollowupEmailRequest(BaseModel):
    profile_id: int
    job_id: int
    contact_id: Optional[int] = None
    previous_date: str = "last week"
    new_value: str = ""


class LinkedInMessageRequest(BaseModel):
    profile_id: int
    job_id: int
    contact_id: Optional[int] = None
    connection_context: str = ""


class LinkedInMessageResponse(BaseModel):
    message: str


# --- Helper to build dicts from DB models ---

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
    """Load and validate profile, job, optional contact — all user-scoped."""
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


# --- Outreach endpoints ---

@router.post("/generate-cold-email", response_model=EmailResponse)
async def generate_cold_email(
    req: ColdEmailRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate high-conversion cold email personalized to profile + job."""
    profile, job, contact = await _load_profile_job_contact(
        db, user, req.profile_id, req.job_id, req.contact_id
    )

    from app.services.ai.content_generator import content_generator

    result = await content_generator.generate_cold_email(
        _profile_dict(profile), _job_dict(job), _contact_dict(contact)
    )

    if not result:
        raise HTTPException(500, "Failed to generate cold email")

    return EmailResponse(**result)


@router.post("/generate-followup", response_model=EmailResponse)
async def generate_followup_email(
    req: FollowupEmailRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate follow-up email. Short, adds new value, zero desperation."""
    profile, job, contact = await _load_profile_job_contact(
        db, user, req.profile_id, req.job_id, req.contact_id
    )

    from app.services.ai.content_generator import content_generator

    result = await content_generator.generate_followup_email(
        _profile_dict(profile), _job_dict(job), _contact_dict(contact),
        previous_date=req.previous_date,
        new_value=req.new_value,
    )

    if not result:
        raise HTTPException(500, "Failed to generate follow-up")

    return EmailResponse(**result)


@router.post("/generate-linkedin-message", response_model=LinkedInMessageResponse)
async def generate_linkedin_message(
    req: LinkedInMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate LinkedIn connection message. Under 50 words, high accept rate."""
    profile, job, contact = await _load_profile_job_contact(
        db, user, req.profile_id, req.job_id, req.contact_id
    )

    from app.services.ai.content_generator import content_generator

    message = await content_generator.generate_linkedin_message(
        _profile_dict(profile), _job_dict(job), _contact_dict(contact),
        connection_context=req.connection_context,
    )

    if not message:
        raise HTTPException(500, "Failed to generate LinkedIn message")

    return LinkedInMessageResponse(message=message)
