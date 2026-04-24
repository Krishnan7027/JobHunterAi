"""Outreach module routes."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.modules.contacts.models import Contact
from app.modules.jobs.models import Job
from app.modules.profile.models import Profile
from app.modules.outreach.models import OutreachMessage
from app.modules.outreach.schemas import OutreachRequest, OutreachOut
from app.modules.outreach.service import outreach_generator

router = APIRouter()


@router.post("/generate", response_model=OutreachOut)
async def generate_outreach(req: OutreachRequest, db: AsyncSession = Depends(get_db)):
    contact_result = await db.execute(
        select(Contact).where(Contact.id == req.contact_id)
    )
    contact = contact_result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")

    profile = None
    if req.profile_id:
        prof_result = await db.execute(
            select(Profile).where(Profile.id == req.profile_id)
        )
        profile = prof_result.scalar_one_or_none()

    # Find associated job
    job = None
    if contact.jobs:
        job = contact.jobs[0]

    contact_dict = {
        "name": contact.name,
        "role": contact.role,
        "company": contact.company,
        "email": contact.email,
        "profile_url": contact.profile_url,
        "verified": contact.verified,
    }
    profile_dict = {
        "name": profile.name if profile else "Candidate",
        "skills": profile.skills if profile else [],
        "experience": profile.experience if profile else [],
        "domains": profile.domains if profile else [],
    }
    job_dict = {
        "title": job.title if job else "Open Position",
        "company": job.company if job else contact.company or "Company",
        "description": job.description if job else "",
    }

    subject = None
    body = ""

    if req.message_type == "email":
        if not contact.verified or not contact.email:
            raise HTTPException(400, "Cannot generate email: no verified email")
        result = await outreach_generator.generate_email(contact_dict, profile_dict, job_dict)
        subject = result.get("subject", "")
        body = result.get("body", "")

    elif req.message_type == "linkedin":
        body = await outreach_generator.generate_linkedin_message(
            contact_dict, profile_dict, job_dict
        )

    elif req.message_type == "followup":
        body = await outreach_generator.generate_followup(
            contact_dict, profile_dict, job_dict,
            previous_contact=req.job_context or "Initial application",
        )
    else:
        raise HTTPException(400, f"Unknown message type: {req.message_type}")

    msg = OutreachMessage(
        contact_id=contact.id,
        message_type=req.message_type,
        subject=subject,
        body=body,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


@router.get("/messages", response_model=list[OutreachOut])
async def list_messages(
    contact_id: int = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(OutreachMessage)
    if contact_id:
        query = query.where(OutreachMessage.contact_id == contact_id)
    query = query.order_by(OutreachMessage.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()
