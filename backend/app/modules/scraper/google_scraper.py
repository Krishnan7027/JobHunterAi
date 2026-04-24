"""Multi-engine job search scraper for LinkedIn and Naukri.

Uses Startpage (privacy search, no CAPTCHA) as primary discovery engine.
Extracts LinkedIn/Naukri job URLs, then parses public job pages.

Strategy:
  1. Startpage search → extract platform URLs
  2. Parse public job listing pages (no login)
  3. Fallback: direct platform search URLs
"""

from __future__ import annotations

import asyncio
import logging
import re
from urllib.parse import quote_plus, urljoin

import httpx
from bs4 import BeautifulSoup

from app.modules.scraper.rate_limiter import rate_limiter

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "DNT": "1",
}

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def search_google_for_platform(
    query: str,
    location: str | None = None,
    platform: str = "linkedin",
    max_results: int = 15,
) -> list[dict]:
    """Search for jobs on a specific platform via Startpage.

    Args:
        query: Job search query.
        location: Location filter.
        platform: "linkedin", "naukri", or "all".
        max_results: Max results.

    Returns:
        List of job dicts tagged with platform and source.
    """
    location_part = f" {location}" if location else ""

    if platform == "linkedin":
        search_queries = [
            f'{query} jobs{location_part} site:linkedin.com/jobs',
            f'{query}{location_part} linkedin.com/jobs/view',
        ]
        url_filter = "linkedin.com"
    elif platform == "naukri":
        search_queries = [
            f'{query} jobs{location_part} site:naukri.com',
            f'{query}{location_part} naukri.com jobs',
        ]
        url_filter = "naukri.com"
    else:
        search_queries = [
            f'{query} jobs{location_part} linkedin OR naukri OR indeed',
        ]
        url_filter = None

    all_jobs: list[dict] = []

    for sq in search_queries:
        if len(all_jobs) >= max_results:
            break

        # Try Startpage (primary — no CAPTCHA)
        jobs = await _startpage_search(sq, platform, url_filter, location, max_results)
        if jobs:
            all_jobs.extend(jobs)
            logger.info("Startpage→%s: %d jobs for '%s'", platform, len(jobs), sq[:50])
            continue

    # Fallback: direct platform listing pages
    if not all_jobs:
        logger.info("Search engines returned 0, trying direct %s listing", platform)
        all_jobs = await _direct_platform_scrape(query, location, platform, max_results)

    # Deduplicate by URL
    seen: set[str] = set()
    unique: list[dict] = []
    for j in all_jobs:
        key = j.get("apply_url", "")
        if key and key not in seen:
            seen.add(key)
            unique.append(j)

    logger.info("Search→%s: %d unique jobs for '%s'", platform, len(unique), query)
    return unique[:max_results]


# ---------------------------------------------------------------------------
# Startpage search (no CAPTCHA, privacy-focused)
# ---------------------------------------------------------------------------

async def _startpage_search(
    search_query: str,
    target_platform: str,
    url_filter: str | None,
    location: str | None,
    max_results: int,
) -> list[dict]:
    """Search via Startpage — privacy search engine, no CAPTCHA."""
    url = f"https://www.startpage.com/do/dsearch?query={quote_plus(search_query)}&cat=web"
    await rate_limiter.wait(url)

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            r = await client.get(url, headers=_HEADERS)
            if r.status_code != 200:
                logger.warning("Startpage returned %d", r.status_code)
                return []

        soup = BeautifulSoup(r.text, "lxml")
        return _parse_search_results(soup, target_platform, url_filter, location, max_results)

    except Exception as exc:
        logger.warning("Startpage search failed: %s", exc)
        return []


def _parse_search_results(
    soup: BeautifulSoup,
    target_platform: str,
    url_filter: str | None,
    location: str | None,
    max_results: int,
) -> list[dict]:
    """Parse search result HTML into job dicts."""
    jobs: list[dict] = []

    platform_domains = {
        "linkedin": "linkedin.com",
        "naukri": "naukri.com",
        "indeed": "indeed.com",
    }

    # Startpage selectors
    for result in soup.select("div.w-gl__result, div.result, section.result"):
        link_el = result.select_one("a.w-gl__result-url, a.result-link, h3 a, a[href^='http']")
        title_el = result.select_one("h3, a.w-gl__result-title, span.title")
        snippet_el = result.select_one("p.w-gl__description, p.result-snippet, div.description")

        if not link_el:
            continue

        href = link_el.get("href", "")
        if not href.startswith("http"):
            continue

        # Filter by platform domain
        if url_filter and url_filter not in href:
            continue

        title = title_el.get_text(strip=True) if title_el else link_el.get_text(strip=True)
        snippet = snippet_el.get_text(strip=True)[:300] if snippet_el else ""

        if not title or len(title) < 5:
            continue

        # Detect platform
        detected = "google"
        for plat, domain in platform_domains.items():
            if domain in href:
                detected = plat
                break

        # Extract company from title
        company = "Unknown"
        for sep in [" - ", " | ", " — ", " at ", " · "]:
            if sep in title:
                parts = title.rsplit(sep, maxsplit=1)
                title = parts[0].strip()
                company = parts[1].strip()
                break

        # Clean suffixes
        for suffix in [" | LinkedIn", " - LinkedIn", " - Naukri.com", " | Naukri", "LinkedIn", "Naukri"]:
            company = company.replace(suffix, "").strip()
            title = title.replace(suffix, "").strip()

        if not title:
            continue

        jobs.append({
            "title": title,
            "company": company,
            "location": location or "",
            "apply_url": href,
            "source_url": href,
            "source": detected,
            "description": snippet,
        })

        if len(jobs) >= max_results:
            break

    return jobs


# ---------------------------------------------------------------------------
# Direct platform listing scrape (fallback)
# ---------------------------------------------------------------------------

async def _direct_platform_scrape(
    query: str,
    location: str | None,
    platform: str,
    max_results: int,
) -> list[dict]:
    """Scrape platform listing pages directly via Playwright."""
    if platform == "linkedin":
        return await _scrape_linkedin_listings(query, location, max_results)
    elif platform == "naukri":
        return await _scrape_naukri_listings(query, location, max_results)
    return []


async def _scrape_linkedin_listings(
    query: str,
    location: str | None,
    max_results: int,
) -> list[dict]:
    """Scrape LinkedIn public job listings (no login required)."""
    # LinkedIn public job search URL
    location_param = f"&location={quote_plus(location)}" if location else ""
    url = f"https://www.linkedin.com/jobs/search/?keywords={quote_plus(query)}{location_param}&position=1&pageNum=0"

    await rate_limiter.wait(url)
    jobs: list[dict] = []

    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
            page = await browser.new_page(
                user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                await asyncio.sleep(2)

                # LinkedIn public listings use these selectors
                cards = await page.query_selector_all(
                    "div.base-card, li.result-card, div.job-search-card"
                )
                logger.info("LinkedIn public: %d cards found", len(cards))

                for card in cards:
                    if len(jobs) >= max_results:
                        break
                    try:
                        title_el = await card.query_selector("h3.base-search-card__title, h3, span.sr-only")
                        company_el = await card.query_selector("h4.base-search-card__subtitle, h4, a.hidden-nested-link")
                        loc_el = await card.query_selector("span.job-search-card__location, span.job-result-card__location")
                        link_el = await card.query_selector("a.base-card__full-link, a[href*='/jobs/view/']")

                        title = (await title_el.inner_text()).strip() if title_el else ""
                        company = (await company_el.inner_text()).strip() if company_el else "Unknown"
                        loc = (await loc_el.inner_text()).strip() if loc_el else (location or "")
                        href = (await link_el.get_attribute("href")) if link_el else ""

                        if not title:
                            continue

                        jobs.append({
                            "title": title,
                            "company": company,
                            "location": loc,
                            "apply_url": href or url,
                            "source_url": href or url,
                            "source": "linkedin",
                            "description": "",
                        })
                    except Exception:
                        continue

            except Exception as exc:
                logger.warning("LinkedIn public scrape failed: %s", exc)
            finally:
                await browser.close()

    except ImportError:
        logger.error("Playwright not installed")

    logger.info("LinkedIn direct: %d jobs for '%s'", len(jobs), query)
    return jobs


async def _scrape_naukri_listings(
    query: str,
    location: str | None,
    max_results: int,
) -> list[dict]:
    """Scrape Naukri via Playwright Firefox (bypasses Akamai CDN)."""
    from app.modules.scraper.playwright_scraper import scrape_naukri
    return await scrape_naukri(query, location, max_results)
