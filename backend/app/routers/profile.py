"""User profile routes (JWT-protected)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import User, Profile

router = APIRouter()


class ProfileResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    summary: Optional[str] = None
    skills: list[str] = []
    experience: list[dict] = []
    education: list[dict] = []
    tools: list[str] = []
    domains: list[str] = []
    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    summary: Optional[str] = None
    skills: Optional[list[str]] = None
    experience: Optional[list[dict]] = None
    education: Optional[list[dict]] = None
    tools: Optional[list[str]] = None
    domains: Optional[list[str]] = None


@router.get("/", response_model=ProfileResponse)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's profile. Creates one if it doesn't exist."""
    result = await db.execute(
        select(Profile).where(Profile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        # Auto-create empty profile for user
        profile = Profile(
            user_id=user.id,
            name=user.username,
            email=user.email,
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    return profile


@router.put("/", response_model=ProfileResponse)
async def update_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's profile. Only provided fields are updated."""
    result = await db.execute(
        select(Profile).where(Profile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        profile = Profile(user_id=user.id)
        db.add(profile)

    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user info."""
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_active": user.is_active,
        "created_at": str(user.created_at),
    }
