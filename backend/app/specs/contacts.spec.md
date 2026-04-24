# Contacts Module Spec

## Purpose
Verified recruiter/contact extraction and storage.

## Endpoints
- `POST /api/contacts/extract/{job_id}` — Extract contacts from job page
- `POST /api/contacts/` — Add contact manually
- `GET /api/contacts/` — List contacts (filters: verified, company)
- `GET /api/contacts/{id}` — Get contact
- `DELETE /api/contacts/{id}` — Delete contact

## Verification Rules
- Email must be regex-confirmed in source text
- AI-extracted emails cross-validated against regex findings
- Mismatches rejected (anti-hallucination)
- Noreply/generic emails filtered
- source_url REQUIRED on every contact
- extraction_type: job_posting | company_page | public_profile

## Dependencies
- core (auth, db)
- ai (gemini_client for structured extraction)
- scraper (page_fetcher for fetching job pages)
