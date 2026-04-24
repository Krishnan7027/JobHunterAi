"""Contacts module models."""

import datetime
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class ExtractionType(str, enum.Enum):
    JOB_POSTING = "job_posting"
    COMPANY_PAGE = "company_page"
    PUBLIC_PROFILE = "public_profile"


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(200), nullable=True)
    role = Column(String(200), nullable=True)
    company = Column(String(200), nullable=True)
    email = Column(String(200), nullable=True)
    profile_url = Column(Text, nullable=True)
    source_url = Column(Text, nullable=False)
    extraction_type = Column(String(30), nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="contacts")
    jobs = relationship("Job", secondary="job_contacts", back_populates="contacts")
