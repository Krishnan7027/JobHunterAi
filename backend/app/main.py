from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db

# Import all models so SQLAlchemy registers them with Base.metadata
import app.core.models  # noqa: F401
import app.modules.profile.models  # noqa: F401
import app.modules.jobs.models  # noqa: F401
import app.modules.contacts.models  # noqa: F401
import app.modules.outreach.models  # noqa: F401
import app.modules.intelligence.models  # noqa: F401

# Import routers
from app.modules.auth.routes import router as auth_router
from app.modules.profile.routes import profile_router, cv_router
from app.modules.jobs.routes import router as jobs_router
from app.modules.contacts.routes import router as contacts_router
from app.modules.outreach.routes import router as outreach_router
from app.modules.dashboard.routes import router as dashboard_router
from app.modules.ai.routes import ai_router, matching_router, advanced_router
from app.modules.intelligence.routes import router as intelligence_router
from app.modules.agents.routes import router as agents_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    description="AI Job Hunter + Verified Recruiter Intelligence Platform (SDD Edition)",
    lifespan=lifespan,
)

allowed_origins = [
    settings.frontend_url,
    "http://localhost:3000",
]
# Support multiple Vercel preview URLs
if settings.frontend_url.endswith(".vercel.app"):
    allowed_origins.append("https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth & Profile
app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(profile_router, prefix="/api/profile", tags=["Profile"])
app.include_router(cv_router, prefix="/api/cv", tags=["CV"])

# Core modules
app.include_router(jobs_router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(contacts_router, prefix="/api/contacts", tags=["Contacts"])
app.include_router(outreach_router, prefix="/api/outreach", tags=["Outreach"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])

# AI-powered
app.include_router(ai_router, prefix="/api/ai", tags=["AI"])
app.include_router(matching_router, prefix="/api/matching", tags=["Matching"])
app.include_router(advanced_router, prefix="/api/advanced", tags=["Advanced"])
app.include_router(intelligence_router, prefix="/api/intelligence", tags=["Intelligence"])
app.include_router(agents_router, prefix="/api/ai", tags=["Agents"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": settings.app_name}


@app.get("/health")
async def health_root():
    """Render health check endpoint."""
    return {"status": "ok"}
