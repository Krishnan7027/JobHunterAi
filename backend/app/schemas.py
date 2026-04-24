# Backward compatibility shim — use app.modules.*.schemas instead
from app.modules.profile.schemas import ProfileBase, ProfileOut, ProfileResponse, ProfileUpdate, SkillGapOut  # noqa: F401
from app.modules.jobs.schemas import JobCreate, JobOut, JobStatusUpdate, JobFetchRequest  # noqa: F401
from app.modules.contacts.schemas import ContactCreate, ContactOut  # noqa: F401
from app.modules.outreach.schemas import OutreachRequest, OutreachOut  # noqa: F401
from app.modules.dashboard.schemas import DashboardStats  # noqa: F401
from app.modules.ai.schemas import (  # noqa: F401
    MatchRequest, MatchResult, SmartApplyRequest, SmartApplyResult,
    ParseCVResponse, MatchJobRequest, MatchJobResponse,
)
