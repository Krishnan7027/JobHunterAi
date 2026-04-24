"""Intelligence module routes — AI Coach, Strategy, Probability, Rejection, Evolution, Follow-up Timing."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.models import User
from app.modules.intelligence.service import intelligence_service
from app.modules.intelligence.schemas import (
    CoachResponse,
    StrategyResponse,
    ProbabilityResponse,
    RejectionAnalysis,
    FollowupTimingResponse,
    EvolutionResponse,
    ProfileSnapshot,
)

router = APIRouter()


@router.get("/coach", response_model=CoachResponse)
async def get_coach_insights(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI Job Coach — daily personalized insights and recommendations."""
    data = await intelligence_service.get_coach_insights(db, user.id)
    return CoachResponse(**data)


@router.get("/strategy", response_model=StrategyResponse)
async def get_strategy(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Application Strategy Engine — which jobs to apply/skip."""
    data = await intelligence_service.get_strategy(db, user.id)
    return StrategyResponse(**data)


@router.post("/probability", response_model=ProbabilityResponse)
async def predict_probability(
    job_ids: Optional[list[int]] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Interview Probability Score — predict interview chance per job."""
    predictions = await intelligence_service.predict_interview_probability(db, user.id, job_ids)
    return ProbabilityResponse(predictions=predictions)


@router.get("/rejection/{job_id}", response_model=RejectionAnalysis)
async def analyze_rejection(
    job_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rejection Analysis — why application was rejected + improvement actions."""
    data = await intelligence_service.analyze_rejection(db, user.id, job_id)
    return RejectionAnalysis(**data)


@router.get("/followup-timing", response_model=FollowupTimingResponse)
async def get_followup_timing(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Smart Follow-up Timing — optimal time to follow up on each applied job."""
    followups = await intelligence_service.get_followup_timing(db, user.id)
    return FollowupTimingResponse(followups=followups)


@router.post("/evolution/snapshot")
async def take_snapshot(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Take a profile evolution snapshot (call periodically or on profile update)."""
    result = await intelligence_service.take_snapshot(db, user.id)
    return result


@router.get("/evolution", response_model=EvolutionResponse)
async def get_evolution(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Profile Evolution — skill growth, score trends, application trends."""
    data = await intelligence_service.get_evolution(db, user.id)
    return EvolutionResponse(**data)
