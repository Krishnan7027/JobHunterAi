# AI Job Hunter + Verified Recruiter Intelligence Platform

## Project Overview

Production-level AI-powered job hunting platform with multi-agent AI system. Zero budget. Gemini AI free tier. Ethical automation only — assists user, never acts on their behalf.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10, FastAPI, SQLAlchemy 2.0 (async), aiosqlite |
| Database | SQLite (`backend/job_hunter.db`) |
| AI Provider | Google Gemini API (`gemini-2.5-flash` / `gemini-3.1-flash-lite-preview`) |
| Frontend | Next.js 16, React 19, TypeScript |
| UI | shadcn/ui (base-ui), Tailwind CSS 4, Framer Motion |
| Auth | JWT (python-jose, bcrypt) |
| Scraping | httpx, BeautifulSoup4, Playwright |
| Caching | diskcache (file-based) |

## Project Structure

```
my-job-hunter/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app entry (9 routers)
│   │   ├── core/
│   │   │   ├── config.py              # Settings (env-based)
│   │   │   ├── database.py            # SQLAlchemy async engine
│   │   │   ├── models.py              # User model
│   │   │   ├── security.py            # JWT utils
│   │   │   ├── dependencies.py        # get_current_user, get_db
│   │   │   └── cache.py               # diskcache wrapper
│   │   ├── modules/
│   │   │   ├── auth/                   # Register, login (JWT)
│   │   │   ├── profile/               # CV upload, profile CRUD
│   │   │   ├── jobs/                   # Job CRUD, fetch, rank, apply, status pipeline
│   │   │   ├── contacts/              # Contact extraction & verification
│   │   │   ├── outreach/              # Email/LinkedIn message generation
│   │   │   ├── dashboard/             # Stats, analytics, daily actions
│   │   │   ├── ai/                    # Gemini client, AI routes, prompts
│   │   │   ├── intelligence/          # AI Coach, Strategy, Probability, Rejection, Evolution
│   │   │   ├── scraper/               # Job orchestrator, parsers, rate limiter
│   │   │   └── agents/                # Multi-agent AI system
│   │   │       ├── base.py            # BaseAgent abstract class, AgentResult, AgentStatus
│   │   │       ├── job_finder.py      # Wraps scraper orchestrator
│   │   │       ├── job_scorer.py      # Wraps AI scoring service
│   │   │       ├── strategy.py        # Wraps intelligence strategy
│   │   │       ├── outreach.py        # Generates cold emails + LinkedIn messages
│   │   │       ├── followup.py        # Follow-up timing recommendations
│   │   │       ├── analytics_agent.py # Performance metrics (single GROUP BY query)
│   │   │       ├── orchestrator.py    # Sequential pipeline with context passing
│   │   │       ├── schemas.py         # Pydantic request/response models
│   │   │       └── routes.py          # POST /api/ai/agent-plan endpoint
│   │   ├── services/                   # Legacy service layer (being consolidated into modules)
│   │   ├── routers/                    # Legacy routers (backward compat shims)
│   │   └── prompts/                    # AI prompt templates (.md)
│   ├── .env                            # GEMINI_API_KEY, JWT_SECRET, etc
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # Dashboard (orchestrates 6 component panels)
│   │   │   ├── pitch/page.tsx         # Investor pitch deck (9 slides, keyboard nav)
│   │   │   ├── pipeline/page.tsx      # Kanban board (drag-drop pipeline)
│   │   │   ├── jobs/page.tsx          # Job search, filter, score, apply
│   │   │   ├── jobs/[id]/page.tsx     # Job detail (scores, AI insights, apply assistant, outreach)
│   │   │   ├── analytics/page.tsx     # Analytics (funnel, trends, AI coach, strategy)
│   │   │   ├── evolution/page.tsx     # Profile evolution (skill growth, score trends, followup timing)
│   │   │   ├── cv/page.tsx            # CV upload, profile management
│   │   │   ├── contacts/page.tsx      # Contact list, extraction
│   │   │   ├── outreach/page.tsx      # Outreach message generation
│   │   │   ├── advanced/page.tsx      # Skill gaps, interview prep, hidden jobs
│   │   │   ├── login/page.tsx         # Auth (login/register)
│   │   │   ├── layout.tsx             # Root layout (sidebar, toaster)
│   │   │   └── globals.css            # Glassmorphism, gradient bg, dark theme
│   │   ├── components/
│   │   │   ├── sidebar.tsx            # Desktop + mobile nav
│   │   │   ├── dashboard/            # Premium dashboard components
│   │   │   │   ├── HeroSection.tsx    # Greeting, quick actions, AI focus, streak
│   │   │   │   ├── JobMatchPanel.tsx  # Top 5 scored jobs with animated bars
│   │   │   │   ├── PipelineBoard.tsx  # Mini pipeline overview (5 status columns)
│   │   │   │   ├── AICoachPanel.tsx   # Daily insights, recommendations
│   │   │   │   ├── AnalyticsPanel.tsx # Conversion funnel, metrics, pipeline bar
│   │   │   │   ├── ProfileEvolution.tsx # Score trend sparkline, skill stats
│   │   │   │   └── AgentPlanButton.tsx # "Execute AI Plan" with live progress modal
│   │   │   └── ui/                    # shadcn components
│   │   └── lib/
│   │       ├── api.ts                 # All API client functions + types
│   │       ├── auth.ts                # Token storage (localStorage)
│   │       ├── auth-context.tsx        # React auth context provider
│   │       └── utils.ts               # cn() helper
│   ├── .env.local                     # NEXT_PUBLIC_API_URL
│   └── package.json
└── CLAUDE.md                          # This file
```

## Database Models

- **User** — id, username, email, password_hash, is_active
- **Profile** — user_id, name, skills[], experience[], education[], tools[], domains[], raw_text, file_name
- **Job** — user_id, title, company, location, description, requirements[], apply_url, platform, status (pipeline), match_score, priority_score, applied_at
- **Application** — user_id, job_id, profile_id, tailored_resume, cover_letter, answers{}, status
- **Contact** — user_id, name, role, company, email, profile_url, extraction_type, verified
- **OutreachMessage** — user_id, contact_id, message_type, subject, body, sent
- **SkillGap** — profile_id, skill_name, demand_count, importance
- **ProfileEvolutionSnapshot** — user_id, skills_count, avg_match_score, total_applications, interviews, offers, conversion_rate, top_skills[], created_at
- **job_contacts** — junction table (Job ↔ Contact M:M)

### Pipeline States (Job.status)

`not_applied` → `saved` → `applied` → `interview` → `offered` / `rejected`

## Multi-Agent AI System

### Architecture
Lightweight orchestrator pattern. Agents are thin wrappers around existing services. No external dependencies. Deterministic Python orchestration — Gemini only for content generation.

### Agent Pipeline Flow
```
User triggers "Execute AI Plan"
  → JobFinderAgent (fetch/reuse jobs)
  → JobScorerAgent (AI score against profile)
  → StrategyAgent (apply/skip recommendations)
  → OutreachAgent (cold emails + LinkedIn for top 3)
  → FollowupAgent (follow-up timing)
  → AnalyticsAgent (performance metrics)
  → Returns unified plan
```

### Safety Rule
Agents DO NOT auto-apply. They only assist the user with recommendations.

### Frontend Integration
"Execute AI Plan" button in HeroSection opens a live progress modal:
- Progress bar fills as agents execute
- Each agent step shows status (running/completed/failed/skipped)
- Elapsed timer during execution
- Results displayed after completion: jobs, messages, follow-ups, stats

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — JWT token

### CV / Profile
- `POST /api/cv/upload` — Upload + AI parse (PDF/DOCX)
- `GET /api/cv/profiles` — List all profiles
- `DELETE /api/cv/profiles/{id}` — Delete profile
- `GET /api/profile/` — Current user profile
- `PUT /api/profile/` — Update profile

### Jobs
- `POST /api/jobs/fetch` — Scrape from sources (Indeed, LinkedIn, Naukri, Google, Hidden)
- `POST /api/jobs/` — Create manually
- `GET /api/jobs/` — List with filters (platform, status, min_score, sort_by)
- `GET /api/jobs/{id}` — Detail
- `PATCH /api/jobs/{id}/status` — Pipeline status change
- `POST /api/jobs/apply` — Track application
- `POST /api/jobs/rank` — AI rank all unscored jobs
- `DELETE /api/jobs/{id}` — Remove

### AI
- `POST /api/ai/prepare-application` — Generate resume + cover letter + answers (combo)
- `POST /api/ai/generate-outreach` — Cold email + LinkedIn + followup (bundle)
- `POST /api/ai/generate-auto-followup` — Smart followup based on days since applied
- `POST /api/ai/generate-cover-letter` — Single cover letter
- `POST /api/ai/generate-cold-email` — Single cold email
- `POST /api/ai/generate-followup` — Single followup
- `POST /api/ai/generate-linkedin-message` — Connection message
- `POST /api/ai/generate-answers` — Application Q&A
- `POST /api/ai/match-job` — Score single job
- `POST /api/ai/analyze-profile` — Strengths, weaknesses, recommendations
- `POST /api/ai/parse-cv` — Parse CV file
- `POST /api/ai/agent-plan` — Execute multi-agent job hunting plan

### Matching
- `POST /api/matching/score` — Batch score jobs
- `POST /api/matching/smart-apply` — Resume + cover letter

### Dashboard
- `GET /api/dashboard/stats` — Pipeline counts, avg score
- `GET /api/dashboard/analytics` — Conversion rate, offer rate, pipeline breakdown
- `GET /api/dashboard/daily-actions` — Recommended followups, top jobs, scoring

### Contacts
- `POST /api/contacts/extract/{job_id}` — Extract from job posting
- `GET /api/contacts/` — List (filter: verified, company)
- `DELETE /api/contacts/{id}` — Remove

### Outreach
- `POST /api/outreach/generate` — Generate message (email/linkedin/followup)
- `GET /api/outreach/messages` — History

### Advanced
- `POST /api/advanced/skill-gaps/{profile_id}` — Gap analysis
- `POST /api/advanced/interview-questions/{job_id}` — Predict questions
- `GET /api/advanced/hidden-jobs` — Discover non-posted jobs
- `GET /api/advanced/daily-digest` — Top matches summary

### Intelligence (AI-powered insights)
- `GET /api/intelligence/coach` — Daily AI coaching insights + recommendations
- `GET /api/intelligence/strategy` — Application strategy (apply/skip with reasons)
- `POST /api/intelligence/probability` — Interview probability score per job
- `GET /api/intelligence/rejection/{job_id}` — Rejection analysis (skill gaps, reasons, actions)
- `GET /api/intelligence/followup-timing` — Smart follow-up timing recommendations
- `POST /api/intelligence/evolution/snapshot` — Take profile evolution snapshot
- `GET /api/intelligence/evolution` — Profile evolution data (trends, skill growth)

## Key Conventions

### Backend
- All routes JWT-protected via `Depends(get_current_user)` (except auth endpoints)
- All data user-scoped (Job.user_id, Contact.user_id, etc.)
- Gemini calls cached by content hash (diskcache, 1hr TTL)
- Rate limiting: 14 RPM for Gemini free tier
- Retry logic: tenacity (3 attempts, exponential backoff)
- Prompt templates in `app/modules/ai/prompts/*.md` using `{variable}` format
- Service singletons: `ai_service`, `intelligence_service`, `dashboard_service`, `job_service`, `profile_service`, `contact_service`, `auth_service`

### Frontend
- All pages `"use client"` (interactive)
- shadcn/ui components use `@base-ui/react` (NOT radix) — `onValueChange` passes `(value: T | null, eventDetails)`, always handle null
- Glassmorphism via `.glass-card` CSS class
- Dark mode only (configured in layout html class)
- Framer Motion for all animations
- `sonner` for toast notifications
- API client in `src/lib/api.ts` — all functions, types, and helpers in one file
- Dashboard uses extracted components in `components/dashboard/`
- Pitch deck at `/pitch` — full-screen overlay, keyboard nav, 9 slides

### Important Gotchas
- base-ui Select `onValueChange` passes `string | null` — always guard: `(v: string | null) => { if (v) setState(v); }`
- base-ui Tabs `onValueChange` passes `string | number | null` — same pattern
- Framer Motion `onDragStart` conflicts with native HTML drag — use wrapper `<div draggable>` around `<motion.div>`
- Gemini free tier quota varies by model. Current: `gemini-3.1-flash-lite-preview`. Fallback: `gemini-2.5-flash`
- CV upload returns 503 when Gemini quota hit — frontend handles gracefully (saves CV, shows warning)
- Agent orchestrator continues on individual agent failure — doesn't block pipeline

## Running Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm install
npm run dev
```

- Backend: http://localhost:8000 (API docs: /docs)
- Frontend: http://localhost:3000
- Pitch Deck: http://localhost:3000/pitch

## Environment Variables

### Backend (.env)
```
GEMINI_API_KEY=         # Google AI Studio key
GEMINI_MODEL=           # gemini-3.1-flash-lite-preview
DATABASE_URL=           # sqlite+aiosqlite:///./job_hunter.db
JWT_SECRET=             # Random string for JWT signing
FRONTEND_URL=           # http://localhost:3000
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=    # http://localhost:8000/api
```
