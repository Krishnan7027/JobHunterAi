"""Dashboard module routes (JWT-protected)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.models import User
from app.modules.dashboard.schemas import DashboardStats, AnalyticsResponse, DailyActionsResponse
from app.modules.dashboard.service import dashboard_service

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard stats scoped to current user."""
    stats = await dashboard_service.get_stats(db, user.id)
    return DashboardStats(**stats)


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Conversion analytics — interviews/applications, offers/applications."""
    data = await dashboard_service.get_analytics(db, user.id)
    return AnalyticsResponse(**data)


@router.get("/daily-actions", response_model=DailyActionsResponse)
async def get_daily_actions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Daily recommended actions — followups, top jobs, scoring."""
    data = await dashboard_service.get_daily_actions(db, user.id)
    return DailyActionsResponse(**data)
