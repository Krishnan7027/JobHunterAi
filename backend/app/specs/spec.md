# AI Job Hunter — System Design Specification

## Architecture

SDD-compliant modular monolith. FastAPI + SQLAlchemy + Gemini AI.

## Module Map

| Module | Purpose | Dependencies |
|--------|---------|-------------|
| core | Config, DB, auth, cache | None |
| auth | User registration/login | core |
| profile | User profiles, CV upload | core, ai |
| jobs | Job scraping, storage, filtering | core, scraper |
| contacts | Verified contact extraction | core, ai, scraper |
| ai | Gemini wrapper, matching, content gen | core |
| scraper | URL discovery, page fetching, parsing | core |
| outreach | Email/LinkedIn message generation | core, ai |
| dashboard | User stats aggregation | core, jobs, contacts |

## Data Flow

```
User → Auth → JWT → All Modules (user_id scoped)
CV Upload → AI.parse_cv → Profile
Search → Scraper → Jobs (tagged by platform)
Job → Contacts.extract → Verified Contacts
Profile + Job → AI.score → Match Score
Profile + Job → AI.generate → Cover Letter / Cold Email
```

## Security

- JWT (HS256, 24h expiry)
- bcrypt password hashing
- User-scoped data isolation (every query filters by user_id)
- No cross-user data access

## AI Provider

- Gemini API (free tier: 15 RPM, 1M TPM)
- Rate limited (14 RPM with sliding window)
- Disk-cached responses (1h TTL)
- Token-optimized prompts (SYSTEM/TASK/RULES/INPUT/OUTPUT format)

## Database

SQLite + SQLAlchemy async. Tables: users, profiles, jobs, contacts, job_contacts, applications, outreach_messages, skill_gaps.
