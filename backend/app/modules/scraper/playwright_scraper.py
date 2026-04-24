"""Playwright-based scraper for Indeed and Naukri.

Uses headless Chromium with robust multi-fallback CSS selectors.
Each extraction step tries multiple selectors — first match wins.
Includes retry logic, scroll-to-load, and detailed logging.
"""

from __future__ import annotations

import asyncio
import logging
from urllib.parse import quote_plus

from app.modules.scraper.rate_limiter import rate_limiter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Selector fallback chains — Indeed changes DOM frequently
# ---------------------------------------------------------------------------

INDEED_CARD_SELECTORS = [
    "div.job_seen_beacon",
    "div.cardOutline",
    "div[data-jk]",
    "td.resultContent",
    "li.css-5lfssm",
    "a.tapItem",
    "div.slider_container div.slider_item",
]

INDEED_TITLE_SELECTORS = [
    "h2.jobTitle a",
    "a.jcs-JobTitle",
    "h2 a[data-jk]",
    "a[class*='jobTitle']",
    "span[id^='jobTitle']",
    "h2 a",
]

INDEED_COMPANY_SELECTORS = [
    "span[data-testid='company-name']",
    "span.companyName",
    "span.css-92r8pb",
    "a[data-tn-element='companyName']",
    "span[class*='company']",
]

INDEED_LOCATION_SELECTORS = [
    "div[data-testid='text-location']",
    "div.companyLocation",
    "div.css-1p0sjhy",
    "span[class*='location']",
]

INDEED_SNIPPET_SELECTORS = [
    "div.job-snippet",
    "div[class*='job-snippet']",
    "ul[style*='list-style']",
    "div.heading6",
    "div[class*='metadata']",
]


async def _query_first(element, selectors: list[str]):
    """Try multiple selectors, return first match or None."""
    for sel in selectors:
        try:
            el = await element.query_selector(sel)
            if el:
                return el
        except Exception:
            continue
    return None


async def _safe_text(element) -> str:
    """Safely extract text from element."""
    if not element:
        return ""
    try:
        return (await element.inner_text()).strip()
    except Exception:
        return ""


async def _safe_attr(element, attr: str) -> str:
    """Safely get attribute from element."""
    if not element:
        return ""
    try:
        return (await element.get_attribute(attr)) or ""
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Indeed scraper
# ---------------------------------------------------------------------------

async def scrape_indeed(
    query: str,
    location: str | None = None,
    max_results: int = 20,
    retries: int = 2,
) -> list[dict]:
    """Scrape Indeed with Playwright. Retries on failure."""
    for attempt in range(1, retries + 1):
        try:
            jobs = await _scrape_indeed_once(query, location, max_results)
            if jobs:
                return jobs
            logger.warning("Indeed attempt %d/%d: 0 jobs, retrying", attempt, retries)
        except Exception as exc:
            logger.warning("Indeed attempt %d/%d failed: %s", attempt, retries, exc)
        if attempt < retries:
            await asyncio.sleep(2)

    logger.error("Indeed: all %d attempts failed for '%s'", retries, query)
    return []


async def _scrape_indeed_once(
    query: str,
    location: str | None,
    max_results: int,
) -> list[dict]:
    """Single Indeed scrape attempt."""
    location_param = quote_plus(location) if location else ""

    # Use country-specific Indeed domain based on location
    domain = "www.indeed.com"
    if location:
        loc_lower = location.lower()
        if any(kw in loc_lower for kw in (
            "india", "bangalore", "bengaluru", "mumbai", "delhi", "hyderabad",
            "chennai", "pune", "kolkata", "noida", "gurgaon", "gurugram",
            "kochi", "cochin", "trivandrum", "thiruvananthapuram", "ahmedabad",
            "jaipur", "lucknow", "chandigarh", "indore", "nagpur", "coimbatore",
            "visakhapatnam", "vizag", "mysore", "mangalore", "bhopal", "surat",
            "patna", "bhubaneswar", "guwahati", "thrissur", "calicut",
        )):
            domain = "in.indeed.com"
        elif any(kw in loc_lower for kw in ("uk", "london", "manchester", "birmingham", "england")):
            domain = "uk.indeed.com"
        elif any(kw in loc_lower for kw in ("canada", "toronto", "vancouver", "montreal")):
            domain = "ca.indeed.com"
        elif any(kw in loc_lower for kw in ("australia", "sydney", "melbourne")):
            domain = "au.indeed.com"

    url = f"https://{domain}/jobs?q={quote_plus(query)}&l={location_param}"

    logger.info("Indeed Playwright: %s", url[:100])
    await rate_limiter.wait(url)

    jobs: list[dict] = []

    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
            locale="en-US",
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
        except Exception as exc:
            logger.warning("Indeed page load failed: %s", exc)
            await browser.close()
            return jobs

        # Wait for any card selector
        card_selector = ", ".join(INDEED_CARD_SELECTORS)
        try:
            await page.wait_for_selector(card_selector, timeout=12000)
        except Exception:
            logger.warning("Indeed: no cards found after wait")

        # Scroll to load more
        for _ in range(4):
            await page.evaluate("window.scrollBy(0, 1000)")
            await asyncio.sleep(0.4)

        # Find cards using fallback chain
        cards = await page.query_selector_all(card_selector)
        logger.info("Indeed: %d raw cards found", len(cards))

        for card in cards:
            if len(jobs) >= max_results:
                break
            try:
                title_el = await _query_first(card, INDEED_TITLE_SELECTORS)
                if not title_el:
                    continue
                title = await _safe_text(title_el)
                if not title or len(title) < 3:
                    continue

                href = await _safe_attr(title_el, "href")
                if href and not href.startswith("http"):
                    href = f"https://www.indeed.com{href}"

                company_el = await _query_first(card, INDEED_COMPANY_SELECTORS)
                company = await _safe_text(company_el) or "Unknown"

                loc_el = await _query_first(card, INDEED_LOCATION_SELECTORS)
                loc = await _safe_text(loc_el) or location or ""

                snippet_el = await _query_first(card, INDEED_SNIPPET_SELECTORS)
                snippet = (await _safe_text(snippet_el))[:300]

                jobs.append({
                    "title": title,
                    "company": company,
                    "location": loc,
                    "apply_url": href,
                    "source_url": href or url,
                    "source": "indeed",
                    "description": snippet,
                })
            except Exception as exc:
                logger.debug("Indeed card parse error: %s", exc)

        await browser.close()

    rate_limiter.mark_visited(url)
    logger.info("Indeed: extracted %d jobs for '%s' in '%s'", len(jobs), query, location)
    return jobs


# ---------------------------------------------------------------------------
# Naukri scraper
# ---------------------------------------------------------------------------

NAUKRI_CARD_SELECTORS = [
    "div.srp-jobtuple-wrapper",
    "article.jobTuple",
    "div.cust-job-tuple",
    "div[class*='jobTuple']",
]

NAUKRI_TITLE_SELECTORS = ["a.title", "a.jobTitle", "h2 a", "a[class*='title']"]
NAUKRI_COMPANY_SELECTORS = ["a.comp-name", "span.comp-name", "a.subTitle", "span[class*='comp']"]
NAUKRI_LOCATION_SELECTORS = ["span.locWdth", "span.loc", "li.location", "span[class*='loc']"]
NAUKRI_SNIPPET_SELECTORS = ["span.job-desc", "div.job-desc", "div[class*='desc']"]


async def scrape_naukri(
    query: str,
    location: str | None = None,
    max_results: int = 20,
    retries: int = 2,
) -> list[dict]:
    """Scrape Naukri.com with Playwright. Retries on failure."""
    for attempt in range(1, retries + 1):
        try:
            jobs = await _scrape_naukri_once(query, location, max_results)
            if jobs:
                return jobs
            logger.warning("Naukri attempt %d/%d: 0 jobs", attempt, retries)
        except Exception as exc:
            logger.warning("Naukri attempt %d/%d failed: %s", attempt, retries, exc)
        if attempt < retries:
            await asyncio.sleep(2)

    return []


async def _scrape_naukri_once(
    query: str,
    location: str | None,
    max_results: int,
) -> list[dict]:
    """Single Naukri scrape attempt.

    KEY: Uses Firefox (not Chromium) — Akamai CDN blocks headless Chromium
    but allows Firefox due to different TLS fingerprint.
    """
    role_slug = query.lower().replace(" ", "-")
    loc_slug = location.lower().replace(" ", "-") if location else ""
    url = f"https://www.naukri.com/{role_slug}-jobs-in-{loc_slug}" if loc_slug else f"https://www.naukri.com/{role_slug}-jobs"

    logger.info("Naukri Firefox: %s", url[:100])
    await rate_limiter.wait(url)

    jobs: list[dict] = []

    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        # CRITICAL: Firefox bypasses Akamai CDN that blocks Chromium
        try:
            browser = await p.firefox.launch(headless=True)
        except Exception:
            logger.error("Firefox not installed — run: python -m playwright install firefox")
            return jobs

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
            viewport={"width": 1366, "height": 768},
            locale="en-IN",
        )
        page = await context.new_page()

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=25000)
        except Exception:
            logger.warning("Naukri page load failed")
            await browser.close()
            return jobs

        # Wait for content to render
        await asyncio.sleep(4)

        card_selector = ", ".join(NAUKRI_CARD_SELECTORS)
        try:
            await page.wait_for_selector(card_selector, timeout=10000)
        except Exception:
            # Check if blocked
            title = await page.title()
            if "access denied" in title.lower():
                logger.warning("Naukri blocked even with Firefox")
                await browser.close()
                return jobs

        # Scroll to load more
        for _ in range(4):
            await page.evaluate("window.scrollBy(0, 800)")
            await asyncio.sleep(0.5)

        cards = await page.query_selector_all(card_selector)
        logger.info("Naukri Firefox: %d raw cards found", len(cards))

        for card in cards:
            if len(jobs) >= max_results:
                break
            try:
                title_el = await _query_first(card, NAUKRI_TITLE_SELECTORS)
                if not title_el:
                    continue
                title = await _safe_text(title_el)
                if not title or len(title) < 3:
                    continue

                href = await _safe_attr(title_el, "href")
                if href and not href.startswith("http"):
                    href = f"https://www.naukri.com{href}"

                raw_company = await _safe_text(await _query_first(card, NAUKRI_COMPANY_SELECTORS)) or "Unknown"
                # Clean company: remove rating numbers (e.g., "TCS\n3.3\n")
                company = raw_company.split("\n")[0].strip()

                raw_loc = await _safe_text(await _query_first(card, NAUKRI_LOCATION_SELECTORS)) or location or ""
                loc = raw_loc.split("\n")[0].strip()

                snippet = (await _safe_text(await _query_first(card, NAUKRI_SNIPPET_SELECTORS)))[:300]

                jobs.append({
                    "title": title,
                    "company": company,
                    "location": loc,
                    "apply_url": href,
                    "source_url": href or url,
                    "source": "naukri",
                    "description": snippet,
                })
            except Exception:
                continue

        await browser.close()

    rate_limiter.mark_visited(url)
    logger.info("Naukri Firefox: extracted %d jobs for '%s'", len(jobs), query)
    return jobs
