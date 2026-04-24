"""URL discovery layer for job search.

Generates search queries for multiple job boards, fetches search result
pages, and extracts + deduplicates job URLs.
"""

from __future__ import annotations

import asyncio
import logging
from urllib.parse import quote_plus, urljoin

from bs4 import BeautifulSoup

from app.services.scraper.page_fetcher import page_fetcher
from app.config import settings

logger = logging.getLogger(__name__)


class URLDiscovery:
    """Discovers job URLs from Google search, Indeed, Naukri, and company pages."""

    def __init__(self) -> None:
        self._seen_urls: set[str] = set()

    def _deduplicate(self, urls: list[str]) -> list[str]:
        """Remove duplicate URLs."""
        unique: list[str] = []
        for url in urls:
            if url and url not in self._seen_urls:
                self._seen_urls.add(url)
                unique.append(url)
        return unique

    # ------------------------------------------------------------------
    # Google search (site-scoped)
    # ------------------------------------------------------------------

    async def discover_google(
        self,
        role: str,
        location: str | None = None,
        max_results: int = 20,
    ) -> list[dict]:
        """Search Google for job listings on LinkedIn, Indeed, Naukri.

        Uses site: operators to scope results. Does NOT scrape behind login walls.
        """
        location_part = f" {location}" if location else ""
        search_query = (
            f'{role}{location_part} '
            'site:linkedin.com/jobs OR site:indeed.com OR site:naukri.com'
        )
        url = (
            f"https://www.google.com/search"
            f"?q={quote_plus(search_query)}"
            f"&num={min(max_results, 20)}"
        )

        jobs: list[dict] = []
        try:
            html = await page_fetcher.fetch(url, skip_if_visited=False)
            if not html:
                return jobs
            soup = BeautifulSoup(html, "lxml")

            for result in soup.select("div.g, div[data-hveid]"):
                link_el = result.select_one("a[href]")
                title_el = result.select_one("h3")
                snippet_el = result.select_one(
                    "div.VwiC3b, span.aCOpRe, div[style*='line-clamp']"
                )

                if not link_el or not title_el:
                    continue

                href = link_el.get("href", "")
                if not href.startswith("http"):
                    continue

                title = _clean(title_el)
                snippet = _clean(snippet_el)

                company = "Unknown"
                if " - " in title:
                    parts = title.rsplit(" - ", maxsplit=1)
                    title = parts[0].strip()
                    company = parts[1].strip()

                source = "google"
                for domain, src in (
                    ("linkedin.com", "linkedin"),
                    ("indeed.com", "indeed"),
                    ("naukri.com", "naukri"),
                    ("glassdoor.com", "glassdoor"),
                ):
                    if domain in href:
                        source = src
                        break

                jobs.append({
                    "title": title,
                    "company": company,
                    "location": location or "",
                    "apply_url": href,
                    "source_url": href,
                    "source": source,
                    "description": snippet,
                })

                if len(jobs) >= max_results:
                    break

        except Exception:
            logger.exception("Google search failed for '%s'", role)

        logger.info("Google: %d jobs for '%s'", len(jobs), role)
        return jobs

    # ------------------------------------------------------------------
    # Indeed direct scraping
    # ------------------------------------------------------------------

    async def discover_indeed(
        self,
        role: str,
        location: str | None = None,
        max_results: int = 20,
    ) -> list[dict]:
        """Scrape Indeed search results."""
        location_param = quote_plus(location) if location else ""
        url = (
            f"https://www.indeed.com/jobs"
            f"?q={quote_plus(role)}"
            f"&l={location_param}"
            f"&limit={max_results}"
        )

        jobs: list[dict] = []
        try:
            html = await page_fetcher.fetch(url, skip_if_visited=False)
            if not html:
                return jobs
            soup = BeautifulSoup(html, "lxml")

            cards = soup.select(
                "div.job_seen_beacon, "
                "div.jobsearch-ResultsList div.result, "
                "div.cardOutline"
            )
            for card in cards:
                title_el = card.select_one(
                    "h2.jobTitle a, a.jcs-JobTitle, h2 a[data-jk]"
                )
                company_el = card.select_one(
                    "span[data-testid='company-name'], span.companyName"
                )
                location_el = card.select_one(
                    "div[data-testid='text-location'], div.companyLocation"
                )
                snippet_el = card.select_one(
                    "div.job-snippet, td.snip, div[class*='job-snippet']"
                )

                if not title_el:
                    continue

                job_link = title_el.get("href", "")
                if job_link and not job_link.startswith("http"):
                    job_link = urljoin("https://www.indeed.com", job_link)

                jobs.append({
                    "title": _clean(title_el),
                    "company": _clean(company_el) or "Unknown",
                    "location": _clean(location_el) or location or "",
                    "apply_url": job_link,
                    "source_url": job_link,
                    "source": "indeed",
                    "description": _clean(snippet_el),
                })

                if len(jobs) >= max_results:
                    break

        except Exception:
            logger.exception("Indeed search failed for '%s'", role)

        logger.info("Indeed: %d jobs for '%s'", len(jobs), role)
        return jobs

    # ------------------------------------------------------------------
    # Naukri direct scraping
    # ------------------------------------------------------------------

    async def discover_naukri(
        self,
        role: str,
        location: str | None = None,
        max_results: int = 20,
    ) -> list[dict]:
        """Scrape Naukri.com search results."""
        role_slug = role.lower().replace(" ", "-")
        location_slug = location.lower().replace(" ", "-") if location else ""
        if location_slug:
            url = f"https://www.naukri.com/{role_slug}-jobs-in-{location_slug}"
        else:
            url = f"https://www.naukri.com/{role_slug}-jobs"

        jobs: list[dict] = []
        try:
            html = await page_fetcher.fetch(url, skip_if_visited=False)
            if not html:
                return jobs
            soup = BeautifulSoup(html, "lxml")

            articles = soup.select(
                "div.srp-jobtuple-wrapper, article.jobTuple, div.cust-job-tuple"
            )
            for article in articles:
                title_el = article.select_one(
                    "a.title, a.jobTitle, h2 a"
                )
                company_el = article.select_one(
                    "a.comp-name, span.comp-name, a.subTitle"
                )
                location_el = article.select_one(
                    "span.locWdth, span.loc, li.location"
                )
                snippet_el = article.select_one(
                    "span.job-desc, div.job-desc"
                )

                if not title_el:
                    continue

                job_link = title_el.get("href", "")
                if job_link and not job_link.startswith("http"):
                    job_link = urljoin("https://www.naukri.com", job_link)

                jobs.append({
                    "title": _clean(title_el),
                    "company": _clean(company_el) or "Unknown",
                    "location": _clean(location_el) or location or "",
                    "apply_url": job_link,
                    "source_url": job_link,
                    "source": "naukri",
                    "description": _clean(snippet_el),
                })

                if len(jobs) >= max_results:
                    break

        except Exception:
            logger.exception("Naukri search failed for '%s'", role)

        logger.info("Naukri: %d jobs for '%s'", len(jobs), role)
        return jobs

    # ------------------------------------------------------------------
    # Company career pages
    # ------------------------------------------------------------------

    async def discover_company_careers(self, company_url: str) -> list[dict]:
        """Crawl company career page for open positions."""
        career_paths = (
            "/careers", "/jobs", "/join-us", "/work-with-us",
            "/opportunities", "/open-positions", "/careers/openings",
        )
        base_url = company_url.rstrip("/")
        company_domain = base_url.split("//")[-1].split("/")[0].replace("www.", "")

        job_keywords = frozenset({
            "engineer", "developer", "manager", "analyst", "designer",
            "lead", "senior", "junior", "architect", "scientist",
            "director", "specialist", "intern", "consultant",
        })

        jobs: list[dict] = []
        for path in career_paths:
            page_url = base_url + path
            try:
                html = await page_fetcher.fetch(page_url)
                if not html:
                    continue
                soup = BeautifulSoup(html, "lxml")

                for link in soup.select("a[href]"):
                    text = _clean(link)
                    href = link.get("href", "")
                    if not text or len(text) < 4:
                        continue
                    if not any(kw in text.lower() for kw in job_keywords):
                        continue
                    if not href.startswith("http"):
                        href = urljoin(page_url, href)

                    jobs.append({
                        "title": text,
                        "company": company_domain,
                        "location": "",
                        "apply_url": href,
                        "source_url": page_url,
                        "source": "company_career",
                        "description": "",
                    })

                if jobs:
                    break

            except Exception:
                logger.debug("Failed to fetch %s", page_url)

        return jobs

    # ------------------------------------------------------------------
    # Hidden jobs (not on major boards)
    # ------------------------------------------------------------------

    async def discover_hidden_jobs(
        self,
        role: str,
        location: str | None = None,
    ) -> list[dict]:
        """Find jobs on company sites not posted to major boards."""
        location_part = f" {location}" if location else ""
        search_query = (
            f'{role}{location_part} careers "apply" '
            "-site:indeed.com -site:linkedin.com -site:glassdoor.com -site:naukri.com"
        )
        url = f"https://www.google.com/search?q={quote_plus(search_query)}&num=20"

        jobs: list[dict] = []
        try:
            html = await page_fetcher.fetch(url, skip_if_visited=False)
            if not html:
                return jobs
            soup = BeautifulSoup(html, "lxml")

            for result in soup.select("div.g, div[data-hveid]"):
                link_el = result.select_one("a[href]")
                title_el = result.select_one("h3")
                snippet_el = result.select_one(
                    "div.VwiC3b, span.aCOpRe, div[style*='line-clamp']"
                )
                if not link_el or not title_el:
                    continue

                href = link_el.get("href", "")
                if not href.startswith("http"):
                    continue

                try:
                    domain = href.split("//")[-1].split("/")[0]
                    company = domain.replace("www.", "").split(".")[0].title()
                except (IndexError, AttributeError):
                    company = "Unknown"

                jobs.append({
                    "title": _clean(title_el),
                    "company": company,
                    "location": location or "",
                    "apply_url": href,
                    "source_url": href,
                    "source": "hidden_job",
                    "description": _clean(snippet_el),
                })

        except Exception:
            logger.exception("Hidden job search failed for '%s'", role)

        logger.info("Hidden jobs: %d for '%s'", len(jobs), role)
        return jobs

    # ------------------------------------------------------------------
    # Orchestrator
    # ------------------------------------------------------------------

    async def discover_all(
        self,
        role: str,
        location: str | None = None,
        sources: list[str] | None = None,
        max_results: int = 20,
    ) -> list[dict]:
        """Fetch jobs from multiple sources concurrently and deduplicate.

        Supported sources: "google", "indeed", "naukri", "hidden".
        """
        if sources is None:
            sources = ["google"]

        source_map = {
            "google": lambda: self.discover_google(role, location, max_results),
            "indeed": lambda: self.discover_indeed(role, location, max_results),
            "naukri": lambda: self.discover_naukri(role, location, max_results),
            "hidden": lambda: self.discover_hidden_jobs(role, location),
        }

        tasks = []
        valid_sources = []
        for src in sources:
            factory = source_map.get(src)
            if factory:
                tasks.append(asyncio.ensure_future(factory()))
                valid_sources.append(src)
            else:
                logger.warning("Unknown source: %s", src)

        if not tasks:
            return []

        results = await asyncio.gather(*tasks, return_exceptions=True)

        all_jobs: list[dict] = []
        for idx, result in enumerate(results):
            if isinstance(result, BaseException):
                logger.error("Source '%s' failed: %s", valid_sources[idx], result)
                continue
            all_jobs.extend(result)

        # Deduplicate by apply_url
        seen: set[str] = set()
        unique: list[dict] = []
        for job in all_jobs:
            key = job.get("apply_url", "")
            if key and key not in seen:
                seen.add(key)
                unique.append(job)
            elif not key:
                unique.append(job)

        logger.info(
            "discover_all: %d total, %d unique from %s",
            len(all_jobs), len(unique), valid_sources,
        )
        return unique[:max_results]


def _clean(element) -> str:
    """Extract clean text from BeautifulSoup element."""
    if element is None:
        return ""
    return element.get_text(separator=" ", strip=True)


# Module-level singleton
url_discovery = URLDiscovery()
