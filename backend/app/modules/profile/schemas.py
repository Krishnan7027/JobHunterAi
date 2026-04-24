"""Profile module schemas."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProfileBase(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    summary: Optional[str] = None
    skills: list[str] = []
    experience: list[dict] = []
    education: list[dict] = []
    tools: list[str] = []
    domains: list[str] = []


class ProfileOut(ProfileBase):
    id: int
    file_name: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class ProfileResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    summary: Optional[str] = None
    skills: list[str] = []
    experience: list[dict] = []
    education: list[dict] = []
    tools: list[str] = []
    domains: list[str] = []
    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    summary: Optional[str] = None
    skills: Optional[list[str]] = None
    experience: Optional[list[dict]] = None
    education: Optional[list[dict]] = None
    tools: Optional[list[str]] = None
    domains: Optional[list[str]] = None


class SkillGapOut(BaseModel):
    skill_name: str
    demand_count: int
    importance: str
    learning_resources: list[dict] = []
    model_config = {"from_attributes": True}
