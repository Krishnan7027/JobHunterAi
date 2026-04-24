"""Dashboard module schemas."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DashboardStats(BaseModel):
    total_jobs: int = 0
    applied_count: int = 0
    saved_count: int = 0
    interview_count: int = 0
    offer_count: int = 0
    rejected_count: int = 0
    verified_contacts: int = 0
    avg_match_score: float = 0.0
    top_skills_demanded: list[dict] = []


class AnalyticsResponse(BaseModel):
    applications: int = 0
    interviews: int = 0
    offers: int = 0
    rejected: int = 0
    saved: int = 0
    conversion_rate: float = 0.0
    offer_rate: float = 0.0
    total_jobs: int = 0
    avg_match_score: float = 0.0
    pipeline: dict = {}


class ActionItem(BaseModel):
    type: str
    title: str
    description: str
    job_id: Optional[int] = None
    job_title: Optional[str] = None
    company: Optional[str] = None
    priority: str = "medium"


class DailyActionsResponse(BaseModel):
    date: str
    actions: list[ActionItem] = []
    top_jobs: list[dict] = []
    followup_needed: list[dict] = []
    total_actions: int = 0
