"""Contacts module routes (JWT-protected)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.models import User
from app.modules.contacts.models import Contact
from app.modules.contacts.schemas import ContactOut, ContactCreate
from app.modules.contacts.service import contact_service
from app.modules.jobs.models import Job, job_contacts

router = APIRouter()


@router.post("/extract/{job_id}")
async def extract_contacts_from_job(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Extract and verify contacts from a user's job posting.

    Returns contacts found + extraction metadata.
    """
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Job not found")

    from app.modules.scraper.page_fetcher import page_fetcher
    import logging
    logger = logging.getLogger(__name__)

    source_url = job.source_url or job.apply_url
    page_text = await page_fetcher.fetch_text(source_url)
    page_fetched = bool(page_text)
    if not page_text:
        page_text = f"{job.title}\n{job.company}\n{job.description or ''}"

    logger.info("Contact extraction for job %d: page_fetched=%s, text_len=%d", job_id, page_fetched, len(page_text))

    verified_contacts = await contact_service.extract_from_text(
        text=page_text,
        source_url=source_url,
        extraction_type="job_posting",
    )

    logger.info("Contact extraction: %d verified contacts from job %d", len(verified_contacts), job_id)

    created = []
    for vc in verified_contacts:
        if vc.get("email"):
            existing = await db.execute(
                select(Contact).where(
                    Contact.email == vc["email"],
                    Contact.user_id == user.id,
                )
            )
            existing_contact = existing.scalar_one_or_none()
            if existing_contact:
                await _link_contact_to_job(db, existing_contact.id, job.id)
                created.append(existing_contact)
                continue

        contact = Contact(
            user_id=user.id,
            name=vc.get("name"),
            role=vc.get("role"),
            company=vc.get("company") or job.company,
            email=vc.get("email"),
            profile_url=vc.get("profile_url"),
            source_url=source_url,
            extraction_type="job_posting",
            verified=vc.get("verified", False),
        )
        db.add(contact)
        await db.flush()
        await _link_contact_to_job(db, contact.id, job.id)
        created.append(contact)

    await db.commit()
    for c in created:
        await db.refresh(c)

    message = None
    if not created:
        message = (
            "No verified contacts found in this job posting. "
            "Most job boards hide recruiter info behind apply buttons. "
            "Try jobs posted directly on company career pages."
        )

    return {
        "contacts": [ContactOut.model_validate(c) for c in created],
        "total": len(created),
        "source_url": source_url,
        "page_fetched": page_fetched,
        "message": message,
    }


@router.post("/", response_model=ContactOut)
async def create_contact(
    data: ContactCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually add a contact for current user."""
    if not data.source_url:
        raise HTTPException(400, "source_url is required")
    if data.extraction_type not in ("job_posting", "company_page", "public_profile"):
        raise HTTPException(400, "Invalid extraction_type")

    contact_data = data.model_dump()
    contact_data["user_id"] = user.id
    contact = Contact(**contact_data)
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.get("/", response_model=list[ContactOut])
async def list_contacts(
    verified: Optional[bool] = Query(None),
    company: str = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List contacts for current user."""
    query = select(Contact).where(Contact.user_id == user.id)
    if verified is not None:
        query = query.where(Contact.verified == verified)
    if company:
        query = query.where(Contact.company.ilike(f"%{company}%"))
    query = query.order_by(Contact.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{contact_id}", response_model=ContactOut)
async def get_contact(
    contact_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.user_id == user.id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")
    return contact


@router.delete("/{contact_id}")
async def delete_contact(
    contact_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.user_id == user.id)
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(404, "Contact not found")
    await db.delete(contact)
    await db.commit()
    return {"status": "deleted"}


async def _link_contact_to_job(db: AsyncSession, contact_id: int, job_id: int) -> None:
    existing = await db.execute(
        select(job_contacts).where(
            job_contacts.c.contact_id == contact_id,
            job_contacts.c.job_id == job_id,
        )
    )
    if not existing.first():
        await db.execute(
            job_contacts.insert().values(contact_id=contact_id, job_id=job_id)
        )
