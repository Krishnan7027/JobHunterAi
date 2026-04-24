"""Contacts module schemas."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ContactCreate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    profile_url: Optional[str] = None
    source_url: str  # REQUIRED
    extraction_type: str  # job_posting | company_page | public_profile
    verified: bool = False
    notes: Optional[str] = None


class ContactOut(BaseModel):
    id: int
    name: Optional[str] = None
    role: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    profile_url: Optional[str] = None
    source_url: str
    extraction_type: str
    verified: bool = False
    notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}
