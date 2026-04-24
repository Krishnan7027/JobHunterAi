"""Jobs module models."""

import datetime
import enum
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, Boolean, JSON, ForeignKey, Table,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Platform(str, enum.Enum):
    LINKEDIN = "linkedin"
    INDEED = "indeed"
    NAUKRI = "naukri"
    GOOGLE = "google"
    COMPANY = "company"
    GLASSDOOR = "glassdoor"
    HIDDEN = "hidden"
    OTHER = "other"


class ApplicationStatus(str, enum.Enum):
    NOT_APPLIED = "not_applied"
    SAVED = "saved"
    APPLIED = "applied"
    INTERVIEW = "interview"
    REJECTED = "rejected"
    OFFERED = "offered"


# Junction table: many-to-many between jobs and contacts
job_contacts = Table(
    "job_contacts",
    Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("job_id", Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
    Column("contact_id", Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False),
)


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    title = Column(String(300), nullable=False)
    company = Column(String(200), nullable=False)
    location = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    requirements = Column(JSON, default=list)
    salary_range = Column(String(100), nullable=True)
    apply_url = Column(Text, nullable=False)
    platform = Column(String(50), default=Platform.OTHER, index=True)
    source_url = Column(Text, nullable=True)
    is_easy_apply = Column(Boolean, default=False)
    is_hidden_job = Column(Boolean, default=False)
    posted_date = Column(String(50), nullable=True)
    match_score = Column(Float, nullable=True)
    skill_match_pct = Column(Float, nullable=True)
    experience_match = Column(Float, nullable=True)
    priority_score = Column(Float, nullable=True)
    status = Column(String(30), default=ApplicationStatus.NOT_APPLIED)
    applied_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="jobs")
    contacts = relationship("Contact", secondary=job_contacts, back_populates="jobs")
    applications = relationship("Application", back_populates="job")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    tailored_resume = Column(Text, nullable=True)
    cover_letter = Column(Text, nullable=True)
    answers = Column(JSON, default=dict)
    channel = Column(String(50), nullable=True)
    status = Column(String(30), default=ApplicationStatus.APPLIED)
    applied_at = Column(DateTime, default=datetime.datetime.utcnow)
    follow_up_dates = Column(JSON, default=list)
    notes = Column(Text, nullable=True)

    job = relationship("Job", back_populates="applications")
