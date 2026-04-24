# Jobs Module Spec

## Purpose
Job discovery, storage, filtering, and status tracking.

## Endpoints
- `POST /api/jobs/fetch` — Scrape jobs from platforms
- `POST /api/jobs/` — Create job manually
- `GET /api/jobs/` — List jobs (filters: platform, status, min_score)
- `GET /api/jobs/{id}` — Get single job
- `GET /api/jobs/{id}/contacts` — Get job's verified contacts
- `PATCH /api/jobs/{id}/status` — Update status
- `DELETE /api/jobs/{id}` — Delete job

## Platform Filter
Supports: linkedin, indeed, naukri, google, company, glassdoor, hidden.
Comma-separated: `?platform=linkedin,naukri`

## Dependencies
- core (auth, db)
- scraper (url_discovery)
- contacts (junction table)

## User Scoping
All queries filter by `user_id` from JWT. User can only see own jobs.
