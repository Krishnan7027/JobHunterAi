"""Profile module models."""

import datetime
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(200), nullable=True)
    email = Column(String(200), nullable=True)
    phone = Column(String(50), nullable=True)
    summary = Column(Text, nullable=True)
    skills = Column(JSON, default=list)
    experience = Column(JSON, default=list)
    education = Column(JSON, default=list)
    tools = Column(JSON, default=list)
    domains = Column(JSON, default=list)
    preferred_roles = Column(JSON, default=list)
    raw_text = Column(Text, nullable=True)
    file_name = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="profiles")


class SkillGap(Base):
    __tablename__ = "skill_gaps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, ForeignKey("profiles.id"), nullable=False)
    skill_name = Column(String(100), nullable=False)
    demand_count = Column(Integer, default=0)
    importance = Column(String(20), default="medium")
    learning_resources = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
