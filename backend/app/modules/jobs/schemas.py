"""Jobs module schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class JobCreate(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: list[str] = []
    salary_range: Optional[str] = None
    apply_url: str
    source: str = "other"
    source_url: Optional[str] = None
    is_easy_apply: bool = False
    is_hidden_job: bool = False
    posted_date: Optional[str] = None


class JobOut(BaseModel):
    id: int
    title: str
    company: str
    location: Optional[str] = None
    description: Optional[str] = None
    requirements: list[str] = []
    salary_range: Optional[str] = None
    apply_url: str
    platform: str = "other"
    source_url: Optional[str] = None
    is_easy_apply: bool = False
    is_hidden_job: bool = False
    posted_date: Optional[str] = None
    match_score: Optional[float] = None
    skill_match_pct: Optional[float] = None
    experience_match: Optional[float] = None
    priority_score: Optional[float] = None
    status: str = "not_applied"
    applied_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class JobStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class JobFetchRequest(BaseModel):
    query: str
    location: Optional[str] = None
    sources: list[str] = Field(default=["google"])
    max_results: int = 20
