"""Pydantic schemas for the AI module.

Includes schemas for CV parsing, job matching, content generation,
outreach, smart apply, and skill gaps.
"""

from pydantic import BaseModel
from typing import Optional


# --- CV Parsing ---

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


# --- Job Matching ---

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


# --- Cover Letter ---

class CoverLetterRequest(BaseModel):
    profile_id: int
    job_id: int


class CoverLetterResponse(BaseModel):
    cover_letter: str


# --- Application Answers ---

class ApplicationAnswersRequest(BaseModel):
    profile_id: int
    job_id: int
    questions: list[str]


class ApplicationAnswerItem(BaseModel):
    question: str
    answer: str


class ApplicationAnswersResponse(BaseModel):
    answers: list[ApplicationAnswerItem] = []


# --- Outreach: Cold Email ---

class ColdEmailRequest(BaseModel):
    profile_id: int
    job_id: int
    contact_id: Optional[int] = None


class EmailResponse(BaseModel):
    subject: str
    body: str


# --- Outreach: Follow-up ---

class FollowupEmailRequest(BaseModel):
    profile_id: int
    job_id: int
    contact_id: Optional[int] = None
    previous_date: str = "last week"
    new_value: str = ""


# --- Outreach: LinkedIn ---

class LinkedInMessageRequest(BaseModel):
    profile_id: int
    job_id: int
    contact_id: Optional[int] = None
    connection_context: str = ""


class LinkedInMessageResponse(BaseModel):
    message: str


# --- Matching Router Schemas ---

class MatchRequest(BaseModel):
    profile_id: Optional[int] = None
    job_ids: Optional[list[int]] = None


class MatchResult(BaseModel):
    job_id: int
    match_score: float
    skill_match_pct: float
    experience_match: float
    priority_score: float
    matched_skills: list[str] = []
    missing_skills: list[str] = []


# --- Smart Apply ---

class SmartApplyRequest(BaseModel):
    job_id: int
    profile_id: int


class SmartApplyResult(BaseModel):
    tailored_resume: str
    cover_letter: str
    is_easy_apply: bool
    application_answers: dict = {}
    recommended_channel: str = "direct"


# --- Profile Analysis ---

class ProfileAnalysisRequest(BaseModel):
    profile_id: int


class ProfileAnalysisResponse(BaseModel):
    strengths: list[str] = []
    weaknesses: list[str] = []
    recommended_roles: list[str] = []
    skill_gaps: list[str] = []
    career_summary: str = ""
    experience_level: str = "unknown"


# --- Skill Gap ---

class SkillGapOut(BaseModel):
    skill_name: str
    demand_count: int
    importance: str
    learning_resources: list[dict] = []
    model_config = {"from_attributes": True}


# --- Prepare Application (combo) ---

class PrepareApplicationRequest(BaseModel):
    job_id: int
    profile_id: Optional[int] = None
    questions: list[str] = []


class PrepareApplicationResponse(BaseModel):
    tailored_resume: str = ""
    cover_letter: str = ""
    answers: list[ApplicationAnswerItem] = []
    is_easy_apply: bool = False
    apply_url: str = ""
    job_title: str = ""
    company: str = ""


# --- Generate Outreach (combined) ---

class GenerateOutreachRequest(BaseModel):
    job_id: int
    profile_id: Optional[int] = None
    contact_id: Optional[int] = None


class GenerateOutreachResponse(BaseModel):
    cold_email: Optional[EmailResponse] = None
    linkedin_message: str = ""
    followup_email: Optional[EmailResponse] = None


# --- Auto Follow-up ---

class AutoFollowupRequest(BaseModel):
    job_id: int
    profile_id: Optional[int] = None
    days_since_applied: int = 7


class AutoFollowupResponse(BaseModel):
    subject: str = ""
    body: str = ""
    job_title: str = ""
    company: str = ""
    days_waiting: int = 0
