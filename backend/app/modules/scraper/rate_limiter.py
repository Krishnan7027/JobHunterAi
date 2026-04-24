"""Per-domain rate limiter for ethical scraping.

Enforces configurable delays per domain to avoid aggressive crawling.
Tracks visited URLs to avoid duplicate fetches.
"""

import asyncio
import logging
import random
import time
from urllib.parse import urlparse

from app.core.config import settings

logger = logging.getLogger(__name__)


class DomainRateLimiter:
    """Per-domain rate limiter with random jitter and visited URL tracking."""

    def __init__(self) -> None:
        self._domain_locks: dict[str, asyncio.Lock] = {}
        self._last_request: dict[str, float] = {}
        self._visited_urls: set[str] = set()

        # Per-domain rate configs (seconds between requests)
        self._domain_delays: dict[str, float] = {
            "google.com": 1.0 / settings.rate_limit_google,
            "www.google.com": 1.0 / settings.rate_limit_google,
            "indeed.com": 1.0 / settings.rate_limit_indeed,
            "www.indeed.com": 1.0 / settings.rate_limit_indeed,
            "naukri.com": 1.0 / settings.rate_limit_naukri,
            "www.naukri.com": 1.0 / settings.rate_limit_naukri,
        }
        self._default_delay = 1.0 / settings.rate_limit_default

    def _get_domain(self, url: str) -> str:
        """Extract domain from URL."""
        try:
            return urlparse(url).netloc.lower()
        except Exception:
            return "unknown"

    def _get_delay(self, domain: str) -> float:
        """Get configured delay for domain."""
        return self._domain_delays.get(domain, self._default_delay)

    def _get_lock(self, domain: str) -> asyncio.Lock:
        """Get or create lock for domain."""
        if domain not in self._domain_locks:
            self._domain_locks[domain] = asyncio.Lock()
        return self._domain_locks[domain]

    async def wait(self, url: str) -> None:
        """Wait appropriate time before making request to this URL's domain."""
        domain = self._get_domain(url)
        lock = self._get_lock(domain)
        delay = self._get_delay(domain)

        async with lock:
            now = time.monotonic()
            last = self._last_request.get(domain, 0.0)
            elapsed = now - last

            if elapsed < delay:
                wait_time = delay - elapsed + random.uniform(0.1, 0.5)
                logger.debug("Rate limit %s: waiting %.2fs", domain, wait_time)
                await asyncio.sleep(wait_time)

            self._last_request[domain] = time.monotonic()

    def is_visited(self, url: str) -> bool:
        """Check if URL was already fetched."""
        return url in self._visited_urls

    def mark_visited(self, url: str) -> None:
        """Mark URL as visited."""
        self._visited_urls.add(url)

    @property
    def visited_count(self) -> int:
        return len(self._visited_urls)


# Module-level singleton
rate_limiter = DomainRateLimiter()
