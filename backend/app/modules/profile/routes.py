"""Profile module routes (JWT-protected).

Merges profile management and CV upload routes.
"""

import os
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.dependencies import get_current_user
from app.core.database import get_db
from app.core.config import settings
from app.core.models import User
from app.modules.profile.models import Profile
from app.modules.profile.schemas import ProfileResponse, ProfileUpdate, ProfileOut
from app.modules.profile.service import profile_service

profile_router = APIRouter()
cv_router = APIRouter()


# ──────────────────────────────────────────────
# Profile routes (prefix: /profile)
# ──────────────────────────────────────────────

@profile_router.get("/", response_model=ProfileResponse)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's profile. Creates one if it doesn't exist."""
    profile = await profile_service.get_or_create_profile(
        db, user.id, user.username, user.email
    )
    return profile


@profile_router.put("/", response_model=ProfileResponse)
async def update_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's profile. Only provided fields are updated."""
    update_data = data.model_dump(exclude_unset=True)
    profile = await profile_service.update_profile(db, user.id, update_data)
    return profile


@profile_router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "created_at": str(user.created_at),
    }


# ──────────────────────────────────────────────
# CV routes (prefix: /cv)
# ──────────────────────────────────────────────

@cv_router.post("/upload", response_model=ProfileOut)
async def upload_cv(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".pdf", ".docx", ".doc"):
        raise HTTPException(400, "Only PDF and DOCX files supported")

    import tempfile
    os.makedirs(settings.upload_dir, exist_ok=True)
    file_path = os.path.join(settings.upload_dir, file.filename)

    content = await file.read()
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    from app.modules.ai.service import ai_service
    try:
        parsed = await ai_service.parse_cv(file_path)
    finally:
        # Clean up temp file after parsing
        try:
            os.remove(file_path)
        except OSError:
            pass

    # Surface AI errors to client
    ai_error = parsed.pop("_error", None)

    profile = Profile(
        user_id=user.id,
        name=parsed.get("name"),
        email=parsed.get("email"),
        phone=parsed.get("phone"),
        summary=parsed.get("summary"),
        skills=parsed.get("skills", []),
        experience=parsed.get("experience", []),
        education=parsed.get("education", []),
        tools=parsed.get("tools", []),
        domains=parsed.get("domains", []),
        raw_text=parsed.get("raw_text", ""),
        file_name=file.filename,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    if ai_error:
        raise HTTPException(
            status_code=503,
            detail=f"CV saved but AI parsing failed: {ai_error}. Raw text preserved — re-parse when quota resets."
        )

    return profile


@cv_router.get("/profiles", response_model=list[ProfileOut])
async def list_profiles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).order_by(Profile.created_at.desc()))
    return result.scalars().all()


@cv_router.get("/profiles/{profile_id}", response_model=ProfileOut)
async def get_profile_by_id(profile_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")
    return profile


@cv_router.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")
    await db.delete(profile)
    await db.commit()
    return {"status": "deleted"}
