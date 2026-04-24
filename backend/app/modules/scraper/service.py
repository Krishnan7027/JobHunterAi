"""Scraper module service facade — re-exports key singletons and classes."""

from app.modules.scraper.url_discovery import url_discovery, URLDiscovery
from app.modules.scraper.page_fetcher import page_fetcher, PageFetcher
from app.modules.scraper.job_parser import job_parser, JobParser
from app.modules.scraper.job_orchestrator import get_jobs as orchestrate_jobs

__all__ = [
    "url_discovery",
    "URLDiscovery",
    "page_fetcher",
    "PageFetcher",
    "job_parser",
    "JobParser",
    "orchestrate_jobs",
]
