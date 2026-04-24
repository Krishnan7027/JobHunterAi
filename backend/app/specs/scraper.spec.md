# Scraper Module Spec

## Purpose
Async web scraping with rate limiting, retry logic, and structured parsing.

## Components
- **URLDiscovery**: Google site-scoped, Indeed, Naukri, career pages, hidden jobs
- **PageFetcher**: httpx async, UA rotation, retry with exponential backoff
- **RateLimiter**: Per-domain throttling (Google 0.5 RPS, Indeed/Naukri 1 RPS)
- **JobParser**: HTML → structured job data (title, company, location, description)

## Safety Features
- Per-domain rate limiting with random jitter
- Visited URL tracking (no duplicate fetches)
- Static user-agent rotation
- No login wall scraping
- No platform automation

## Dependencies
- core.config (rate limit settings)

## No direct API endpoints
Consumed by jobs module (fetch) and contacts module (page text extraction).
