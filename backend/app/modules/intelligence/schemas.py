"""Intelligence module schemas — AI Coach, Strategy, Probability, Rejection Analysis, Evolution."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# --- AI Job Coach ---

class CoachInsight(BaseModel):
    insight: str
    recommendation: str
    category: str = "general"
    priority: str = "medium"


class CoachResponse(BaseModel):
    insights: list[CoachInsight] = []
    daily_summary: str = ""
    streak_days: int = 0


# --- Application Strategy Engine ---

class StrategyJob(BaseModel):
    job_id: int
    title: str
    company: str
    score: float = 0
    reason: str = ""


class StrategyResponse(BaseModel):
    apply: list[StrategyJob] = []
    skip: list[StrategyJob] = []
    summary: str = ""


# --- Interview Probability ---

class InterviewProbability(BaseModel):
    job_id: int
    title: str
    company: str
    interview_probability: float = 0
    factors: list[str] = []
    recommendation: str = ""


class ProbabilityResponse(BaseModel):
    predictions: list[InterviewProbability] = []


# --- Rejection Analysis ---

class RejectionAnalysis(BaseModel):
    job_id: int
    title: str
    company: str
    skill_gaps: list[str] = []
    experience_mismatch: str = ""
    possible_reasons: list[str] = []
    improvement_actions: list[str] = []


# --- Smart Follow-up Timing ---

class FollowupTiming(BaseModel):
    job_id: int
    title: str
    company: str
    days_since_applied: int = 0
    recommended_action: str = ""
    optimal_day: str = ""
    urgency: str = "medium"
    message_tone: str = ""


class FollowupTimingResponse(BaseModel):
    followups: list[FollowupTiming] = []


# --- Profile Evolution ---

class ProfileSnapshot(BaseModel):
    id: int
    user_id: int
    skills_count: int = 0
    avg_match_score: float = 0
    total_applications: int = 0
    interviews: int = 0
    offers: int = 0
    conversion_rate: float = 0
    top_skills: list[str] = []
    created_at: datetime
    model_config = {"from_attributes": True}


class EvolutionResponse(BaseModel):
    snapshots: list[ProfileSnapshot] = []
    skill_growth: dict = {}
    score_trend: list[dict] = []
    application_trend: list[dict] = []
    summary: str = ""
