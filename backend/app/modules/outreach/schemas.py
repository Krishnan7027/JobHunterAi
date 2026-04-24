"""Outreach module schemas."""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class OutreachRequest(BaseModel):
    contact_id: int
    message_type: str = "email"
    job_context: Optional[str] = None
    profile_id: Optional[int] = None


class OutreachOut(BaseModel):
    id: int
    contact_id: int
    message_type: str
    subject: Optional[str] = None
    body: str
    sent: bool = False
    created_at: datetime
    model_config = {"from_attributes": True}
