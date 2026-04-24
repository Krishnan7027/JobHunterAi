# AI Job Hunter + Verified Recruiter Intelligence Platform

Production-level AI job hunting platform with intelligent coaching, application strategy, and career evolution tracking. Zero budget — Gemini AI free tier. Ethical automation only.

## Features

### Core Platform
- **CV Intelligence** — Upload PDF/DOCX, AI extracts skills, experience, tools, domains
- **Multi-Source Job Scraping** — Indeed, LinkedIn, Naukri, Google, company career pages, hidden jobs
- **AI Job Matching** — Skill match %, experience match, semantic scoring via Gemini
- **Application Pipeline** — Kanban board: Saved → Applied → Interview → Offer / Rejected
- **Verified Contact Extraction** — Regex + AI cross-validation, never guesses emails
- **Outreach Automation** — Cold emails, LinkedIn messages, follow-ups (for manual sending)

### AI Intelligence Layer
- **AI Job Coach** — Daily personalized insights based on profile + activity trends
- **Application Strategy Engine** — Which jobs to apply to vs skip, with reasons
- **Interview Probability Score** — 0-100 prediction per job with contributing factors
- **Rejection Analysis** — Skill gaps, experience mismatch, improvement actions
- **Smart Follow-up Timing** — Optimal day/urgency/tone for each pending application
- **Profile Evolution Tracker** — Skill growth, score trends, conversion metrics over time

### Application Assistant
- **Auto-Apply Assist** — Generates tailored resume + cover letter + answers (user applies manually)
- **Outreach Bundle** — Cold email + LinkedIn + follow-up generated together
- **Interview Prep** — Predicted questions based on job + profile

### Analytics & Insights
- **Conversion Funnel** — Applications → Interviews → Offers with rates
- **Pipeline Visualization** — Status breakdown with animated bars
- **Daily Actions** — AI-recommended next steps (follow-ups, top jobs, scoring)
- **Streak Tracking** — Consecutive days of job hunt activity

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10, FastAPI, SQLAlchemy 2.0 (async), aiosqlite |
| Database | SQLite |
| AI | Google Gemini API (free tier — gemini-3.1-flash-lite-preview) |
| Scraping | httpx, BeautifulSoup4, Playwright |
| Caching | diskcache (file-backed, 1hr TTL) |
| Frontend | Next.js 16, React 19, TypeScript |
| UI | shadcn/ui (base-ui), Tailwind CSS 4, Framer Motion |
| Auth | JWT (python-jose, bcrypt) |

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env: add GEMINI_API_KEY (free at https://aistudio.google.com/apikey)
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Environment Variables

### Backend (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | Yes | — | Google AI Studio API key (free) |
| `GEMINI_MODEL` | No | gemini-3.1-flash-lite-preview | Gemini model name |
| `DATABASE_URL` | No | sqlite+aiosqlite:///./job_hunter.db | Database path |
| `JWT_SECRET` | Yes | — | Random string for JWT signing |
| `FRONTEND_URL` | No | http://localhost:3000 | CORS origin |
| `SCRAPE_DELAY` | No | 2.0 | Base delay between scrape requests |

### Frontend (.env.local)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | http://localhost:8000/api | Backend API base URL |

## Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Stats, analytics, daily actions, AI insights |
| Pipeline | `/pipeline` | Drag-and-drop Kanban board |
| Jobs | `/jobs` | Search, filter, score, apply |
| Job Detail | `/jobs/[id]` | Scores, AI predictions, apply assistant, outreach |
| Analytics | `/analytics` | Conversion funnel, trends, AI coach, strategy |
| Evolution | `/evolution` | Skill growth, score trends, follow-up timing |
| CV Profile | `/cv` | Upload CV, manage profiles |
| Contacts | `/contacts` | Verified contacts list |
| Outreach | `/outreach` | Message generation + history |
| Advanced | `/advanced` | Skill gaps, interview prep, hidden jobs |

## API Endpoints

### Auth
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Get JWT token

### CV / Profile
- `POST /api/cv/upload` — Upload + AI parse CV
- `GET /api/cv/profiles` — List profiles
- `DELETE /api/cv/profiles/{id}` — Delete profile

### Jobs
- `POST /api/jobs/fetch` — Scrape from sources
- `GET /api/jobs/` — List with filters
- `GET /api/jobs/{id}` — Detail
- `PATCH /api/jobs/{id}/status` — Pipeline status change
- `POST /api/jobs/apply` — Track application
- `POST /api/jobs/rank` — AI rank unscored jobs

### AI
- `POST /api/ai/prepare-application` — Resume + cover letter + answers
- `POST /api/ai/generate-outreach` — Cold email + LinkedIn + followup bundle
- `POST /api/ai/generate-auto-followup` — Smart followup
- `POST /api/ai/generate-cover-letter` — Cover letter
- `POST /api/ai/generate-cold-email` — Cold email
- `POST /api/ai/generate-followup` — Follow-up email
- `POST /api/ai/generate-linkedin-message` — LinkedIn message
- `POST /api/ai/generate-answers` — Application Q&A
- `POST /api/ai/match-job` — Score single job
- `POST /api/ai/analyze-profile` — Profile analysis

### Intelligence
- `GET /api/intelligence/coach` — AI coaching insights
- `GET /api/intelligence/strategy` — Apply/skip recommendations
- `POST /api/intelligence/probability` — Interview probability per job
- `GET /api/intelligence/rejection/{job_id}` — Rejection analysis
- `GET /api/intelligence/followup-timing` — Smart follow-up timing
- `POST /api/intelligence/evolution/snapshot` — Take evolution snapshot
- `GET /api/intelligence/evolution` — Profile evolution data

### Dashboard
- `GET /api/dashboard/stats` — Pipeline counts
- `GET /api/dashboard/analytics` — Conversion metrics
- `GET /api/dashboard/daily-actions` — Recommended actions

### Contacts & Outreach
- `POST /api/contacts/extract/{job_id}` — Extract from job
- `GET /api/contacts/` — List contacts
- `POST /api/outreach/generate` — Generate message
- `GET /api/outreach/messages` — Message history

### Advanced
- `POST /api/advanced/skill-gaps/{profile_id}` — Gap analysis
- `POST /api/advanced/interview-questions/{job_id}` — Predict questions
- `GET /api/advanced/hidden-jobs` — Hidden job discovery

## Architecture

```
backend/app/
├── main.py                     # FastAPI app + CORS + lifespan
├── core/                       # Config, DB, auth, cache
├── modules/
│   ├── auth/                   # JWT register/login
│   ├── profile/                # CV upload, profile CRUD
│   ├── jobs/                   # Job CRUD, scraping, ranking, pipeline
│   ├── contacts/               # Extraction + verification
│   ├── outreach/               # Message generation
│   ├── dashboard/              # Stats, analytics, daily actions
│   ├── ai/                     # Gemini client, prompts, AI routes
│   ├── intelligence/           # Coach, strategy, probability, rejection, evolution
│   └── scraper/                # Job orchestrator, parsers, rate limiter

frontend/src/
├── app/                        # Next.js pages (10 routes)
├── components/                 # Sidebar, shadcn UI components
└── lib/                        # API client, auth, utils
```

## Sample Workflow

```
1. Upload CV        → AI extracts skills + experience
2. Search jobs      → Scrape from Indeed/LinkedIn/Google
3. AI rank          → Score all jobs against profile
4. View strategy    → AI recommends apply vs skip
5. Prepare app      → Generate tailored resume + cover letter
6. Apply manually   → Track in pipeline
7. Follow up        → AI suggests timing + generates email
8. Track evolution  → Monitor growth over time
```

## Zero-Cost Constraints

- Gemini free tier: varies by model (20-1500 RPD)
- No paid APIs, proxies, or SaaS
- No LinkedIn login scraping — public search only
- No platform automation — generates content for manual use
- All data from public sources with source attribution

## Compliance & Ethics

- **No hallucinated data** — all info from verifiable sources
- **No guessed emails** — regex cross-validation rejects AI hallucinations
- **No login wall scraping** — public search results only
- **No platform automation** — templates for manual use
- **Source attribution** — every contact has verifiable source_url
- **Rate limiting** — per-domain throttling respects site policies

## License

MIT
