"""Job scraping orchestrator — multi-source with threshold-based fallback.

Source strategies:
  indeed   → Playwright direct (in.indeed.com for India)
  linkedin → Startpage search → LinkedIn public listings
  naukri   → Startpage search → Naukri Playwright
  google   → Startpage generic search
  hidden   → Google excluding major boards

Fallback: only triggers when results < MIN_RESULTS threshold.
"""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

MIN_RESULTS = 3  # Minimum jobs before triggering fallback


async def get_jobs(
    query: str,
    location: str | None = None,
    sources: list[str] | None = None,
    max_results: int = 20,
) -> tuple[list[dict], str]:
    """Orchestrate job scraping.

    Returns (jobs_list, source_label).
    """
    if sources is None:
        sources = ["linkedin"]

    # Check cache (10 min TTL)
    from app.core.cache import cache_manager
    import json
    cache_key = cache_manager.hash_key("scrape", query, location or "", ",".join(sorted(sources)))
    cached = cache_manager.get(cache_key)
    if cached:
        try:
            data = json.loads(cached)
            logger.info("Cache hit: %d jobs for '%s' from %s", len(data["jobs"]), query, data["source"])
            return data["jobs"], data["source"] + "_cached"
        except Exception:
            pass

    jobs: list[dict] = []
    sources_used: list[str] = []
    platform_counts: dict[str, int] = {}
    fallback_used = False

    # Scrape each requested source
    for src in sources:
        if len(jobs) >= max_results:
            break

        remaining = max_results - len(jobs)
        logger.info("Scraping source '%s' for '%s' in '%s' (need %d more)", src, query, location, remaining)

        src_jobs = await _scrape_source(src, query, location, remaining)
        count = len(src_jobs)
        platform_counts[src] = count

        if src_jobs:
            jobs.extend(src_jobs)
            sources_used.append(src)
            logger.info("Source '%s': %d jobs found", src, count)
        else:
            logger.warning("Source '%s': 0 jobs found", src)

    # Threshold-based fallback chain: naukri → google → indeed
    if len(jobs) < MIN_RESULTS:
        fallback_chain = ["naukri", "google", "indeed"]
        for fb_src in fallback_chain:
            if fb_src in sources or len(jobs) >= MIN_RESULTS:
                continue
            logger.warning(
                "Only %d jobs from %s (below threshold %d) — fallback to %s",
                len(jobs), sources, MIN_RESULTS, fb_src,
            )
            fb_jobs = await _scrape_source(fb_src, query, location, max_results - len(jobs))
            if fb_jobs:
                jobs.extend(fb_jobs)
                sources_used.append(f"{fb_src}_fallback")
                platform_counts[f"{fb_src}_fallback"] = len(fb_jobs)
                fallback_used = True

    # Deduplicate
    from app.modules.jobs.deduplicator import deduplicate_jobs
    unique = deduplicate_jobs(jobs)

    source_label = ",".join(sources_used) if sources_used else "none"
    logger.info(
        "Orchestrator: %d total → %d unique | sources=%s | platforms=%s | fallback=%s",
        len(jobs), len(unique), source_label, platform_counts, fallback_used,
    )

    result = unique[:max_results]

    # Cache results (10 min)
    if result:
        try:
            cache_manager.set(cache_key, json.dumps({"jobs": result, "source": source_label}), expire=600)
        except Exception:
            pass

    return result, source_label


async def _scrape_source(
    source: str,
    query: str,
    location: str | None,
    max_results: int,
) -> list[dict]:
    """Scrape a single source."""
    try:
        if source == "indeed":
            try:
                from app.modules.scraper.playwright_scraper import scrape_indeed
                return await scrape_indeed(query, location, max_results)
            except (ImportError, Exception) as pw_exc:
                logger.warning("Playwright unavailable for Indeed, falling back to Google: %s", pw_exc)
                from app.modules.scraper.google_scraper import search_google_for_platform
                return await search_google_for_platform(query, location, platform="indeed", max_results=max_results)

        elif source == "linkedin":
            from app.modules.scraper.google_scraper import search_google_for_platform
            return await search_google_for_platform(query, location, platform="linkedin", max_results=max_results)

        elif source == "naukri":
            from app.modules.scraper.google_scraper import search_google_for_platform
            return await search_google_for_platform(query, location, platform="naukri", max_results=max_results)

        elif source == "google":
            from app.modules.scraper.google_scraper import search_google_for_platform
            return await search_google_for_platform(query, location, platform="all", max_results=max_results)

        elif source == "hidden":
            from app.modules.scraper.url_discovery import url_discovery
            return await url_discovery.discover_hidden_jobs(query, location)

        else:
            logger.warning("Unknown source: %s", source)
            return []

    except Exception as exc:
        logger.error("Source '%s' failed: %s", source, exc)
        return []
