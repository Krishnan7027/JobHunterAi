import os
import aiofiles
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Profile
from app.schemas import ProfileOut
from app.config import settings

router = APIRouter()


@router.post("/upload", response_model=ProfileOut)
async def upload_cv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".pdf", ".docx", ".doc"):
        raise HTTPException(400, "Only PDF and DOCX files supported")

    os.makedirs(settings.upload_dir, exist_ok=True)
    file_path = os.path.join(settings.upload_dir, file.filename)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    from app.services.cv_parser import parse_cv
    parsed = await parse_cv(file_path)

    profile = Profile(
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
    return profile


@router.get("/profiles", response_model=list[ProfileOut])
async def list_profiles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).order_by(Profile.created_at.desc()))
    return result.scalars().all()


@router.get("/profiles/{profile_id}", response_model=ProfileOut)
async def get_profile(profile_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")
    return profile


@router.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Profile).where(Profile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(404, "Profile not found")
    await db.delete(profile)
    await db.commit()
    return {"status": "deleted"}
