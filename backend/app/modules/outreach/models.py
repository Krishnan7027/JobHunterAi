"""Outreach module models."""

import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey

from app.core.database import Base


class OutreachMessage(Base):
    __tablename__ = "outreach_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    message_type = Column(String(30), nullable=False)
    subject = Column(String(300), nullable=True)
    body = Column(Text, nullable=False)
    sent = Column(Boolean, default=False)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
