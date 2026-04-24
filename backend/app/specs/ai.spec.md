# AI Module Spec

## Purpose
Gemini API integration for CV parsing, job matching, and content generation.

## Endpoints
- `POST /api/ai/parse-cv` — Upload CV, get structured JSON
- `POST /api/ai/match-job` — Score profile vs job
- `POST /api/ai/generate-cover-letter` — Tailored cover letter
- `POST /api/ai/generate-answers` — Application question answers
- `POST /api/ai/generate-cold-email` — High-conversion cold email
- `POST /api/ai/generate-followup` — Follow-up email
- `POST /api/ai/generate-linkedin-message` — LinkedIn connection message
- `POST /api/matching/score` — Batch job scoring
- `POST /api/matching/smart-apply` — Resume + cover letter combo
- `POST /api/advanced/skill-gaps/{id}` — Skill gap analysis
- `POST /api/advanced/interview-questions/{id}` — Predict questions
- `GET /api/advanced/hidden-jobs` — Find unlisted jobs
- `GET /api/advanced/daily-digest` — Top matches summary

## Gemini Client
- Model: gemini-2.0-flash (free tier)
- Rate limit: 14 RPM sliding window
- Retry: 3 attempts, exponential backoff
- Cache: diskcache, 1h TTL
- Temperature: 0.3 (accuracy), 0.5-0.6 (creativity)

## Prompt Templates (14 files)
All in SYSTEM/TASK/RULES/INPUT/OUTPUT format. Token-optimized.

## Dependencies
- core (config, cache, auth)
- profile.models (Profile, SkillGap)
- jobs.models (Job)
