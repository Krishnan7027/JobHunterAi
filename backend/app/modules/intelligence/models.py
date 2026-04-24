"""Intelligence module models — Profile snapshots for evolution tracking."""

import datetime
from sqlalchemy import Column, Integer, Float, String, JSON, DateTime, ForeignKey
from app.core.database import Base


class ProfileEvolutionSnapshot(Base):
    __tablename__ = "profile_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    skills_count = Column(Integer, default=0)
    avg_match_score = Column(Float, default=0.0)
    total_applications = Column(Integer, default=0)
    interviews = Column(Integer, default=0)
    offers = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0.0)
    top_skills = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
