from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models import Job, Contact, User
from app.schemas import DashboardStats
from app.auth import get_current_user

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard stats scoped to current user."""
    uid = user.id

    total = (await db.execute(
        select(func.count(Job.id)).where(Job.user_id == uid)
    )).scalar() or 0

    applied = (await db.execute(
        select(func.count(Job.id)).where(Job.user_id == uid, Job.status == "applied")
    )).scalar() or 0

    saved = (await db.execute(
        select(func.count(Job.id)).where(Job.user_id == uid, Job.status == "saved")
    )).scalar() or 0

    interview = (await db.execute(
        select(func.count(Job.id)).where(Job.user_id == uid, Job.status == "interview")
    )).scalar() or 0

    verified = (await db.execute(
        select(func.count(Contact.id)).where(Contact.user_id == uid, Contact.verified == True)
    )).scalar() or 0

    avg_score = (await db.execute(
        select(func.avg(Job.match_score)).where(Job.user_id == uid, Job.match_score.isnot(None))
    )).scalar() or 0

    return DashboardStats(
        total_jobs=total,
        applied_count=applied,
        saved_count=saved,
        interview_count=interview,
        verified_contacts=verified,
        avg_match_score=round(avg_score, 1),
        top_skills_demanded=[],
    )
