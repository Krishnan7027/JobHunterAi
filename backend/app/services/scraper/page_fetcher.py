"""Async page fetcher with retry, user-agent rotation, and rate limiting.

Uses httpx for async HTTP. Playwright fallback NOT included (zero-cost constraint).
"""

from __future__ import annotations

import logging

import httpx
from fake_useragent import UserAgent
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.services.scraper.rate_limiter import rate_limiter

logger = logging.getLogger(__name__)

_RETRYABLE = (
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    httpx.ConnectError,
    httpx.RemoteProtocolError,
)


class PageFetcher:
    """Fetches web pages with rate limiting, retries, and UA rotation."""

    def __init__(self) -> None:
        self._ua = UserAgent(
            fallback="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        )

    def _headers(self) -> dict[str, str]:
        return {
            "User-Agent": self._ua.random,
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/avif,image/webp,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        retry=retry_if_exception_type(_RETRYABLE),
        reraise=True,
    )
    async def fetch(self, url: str, skip_if_visited: bool = True) -> str:
        """Fetch a page with rate limiting and retries.

        Args:
            url: URL to fetch.
            skip_if_visited: Return empty string if already fetched.

        Returns:
            HTML content as string, or empty string on skip/error.
        """
        if skip_if_visited and rate_limiter.is_visited(url):
            logger.debug("Skipping visited URL: %s", url[:80])
            return ""

        await rate_limiter.wait(url)
        logger.info("Fetching: %s", url[:100])

        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=httpx.Timeout(30.0, connect=10.0),
            http2=True,
        ) as client:
            response = await client.get(url, headers=self._headers())
            response.raise_for_status()
            rate_limiter.mark_visited(url)
            return response.text

    async def fetch_text(self, url: str) -> str:
        """Fetch page and extract clean text (no HTML tags)."""
        from bs4 import BeautifulSoup

        try:
            html = await self.fetch(url, skip_if_visited=False)
            if not html:
                return ""
            soup = BeautifulSoup(html, "lxml")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)
            return text[:5000]  # Truncate for token limits
        except Exception as exc:
            logger.error("Failed to fetch text from %s: %s", url[:80], exc)
            return ""


# Module-level singleton
page_fetcher = PageFetcher()
