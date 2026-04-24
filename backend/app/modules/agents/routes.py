"""Agent system routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.models import User
from app.modules.agents.orchestrator import orchestrator
from app.modules.agents.schemas import AgentPlanRequest, AgentPlanResponse

router = APIRouter()


@router.post("/agent-plan", response_model=AgentPlanResponse)
async def execute_agent_plan(
    req: AgentPlanRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute the multi-agent job hunting plan.

    Runs agents in sequence: Find -> Score -> Strategize -> Outreach -> Follow-up -> Analytics.

    Safety: Agents DO NOT auto-apply. They only assist the user with recommendations.
    """
    result = await orchestrator.execute_plan(
        db=db,
        user_id=user.id,
        query=req.query,
        location=req.location,
        skip_fetch=req.skip_fetch,
    )
    return AgentPlanResponse(**result)
