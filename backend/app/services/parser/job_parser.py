"""Job posting parser.

Fetches full job page content and extracts structured fields:
title, company, location, description, apply_url, source_url.
"""

from __future__ import annotations

import logging
import re

from bs4 import BeautifulSoup

from app.services.scraper.page_fetcher import page_fetcher

logger = logging.getLogger(__name__)


class JobParser:
    """Extracts structured job data from HTML pages."""

    async def enrich_job(self, job_url: str) -> dict:
        """Fetch full job page and extract detailed info.

        Args:
            job_url: URL of the job posting.

        Returns:
            Dict with full_text, extracted fields, and source_url.
        """
        try:
            html = await page_fetcher.fetch(job_url, skip_if_visited=False)
            if not html:
                return {"full_text": "", "source_url": job_url}

            soup = BeautifulSoup(html, "lxml")

            # Strip non-content elements
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()

            # Extract structured fields
            title = self._extract_title(soup)
            company = self._extract_company(soup)
            location = self._extract_location(soup)
            description = self._extract_description(soup)

            full_text = soup.get_text(separator="\n", strip=True)[:5000]

            return {
                "title": title,
                "company": company,
                "location": location,
                "description": description,
                "full_text": full_text,
                "source_url": job_url,
            }

        except Exception as exc:
            logger.error("Failed to parse job from %s: %s", job_url[:80], exc)
            return {"full_text": "", "source_url": job_url, "error": str(exc)}

    def parse_job_html(self, html: str, source_url: str) -> dict:
        """Parse job data from raw HTML string.

        Args:
            html: Raw HTML content.
            source_url: URL where HTML was fetched from.

        Returns:
            Structured job dict.
        """
        if not html:
            return {"source_url": source_url}

        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        return {
            "title": self._extract_title(soup),
            "company": self._extract_company(soup),
            "location": self._extract_location(soup),
            "description": self._extract_description(soup),
            "full_text": soup.get_text(separator="\n", strip=True)[:5000],
            "source_url": source_url,
        }

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract job title from common HTML patterns."""
        # Try structured data first
        for selector in [
            "h1.jobTitle", "h1.job-title", "h1[class*='title']",
            "h1[data-testid*='title']", "h1",
            "meta[property='og:title']",
        ]:
            el = soup.select_one(selector)
            if el:
                if el.name == "meta":
                    return el.get("content", "")
                text = el.get_text(strip=True)
                if text and len(text) < 200:
                    return text
        return ""

    def _extract_company(self, soup: BeautifulSoup) -> str:
        """Extract company name."""
        for selector in [
            "a[data-testid*='company']", "span[class*='company']",
            "div[class*='company']", "a[class*='company']",
            "meta[property='og:site_name']",
        ]:
            el = soup.select_one(selector)
            if el:
                if el.name == "meta":
                    return el.get("content", "")
                text = el.get_text(strip=True)
                if text and len(text) < 100:
                    return text
        return ""

    def _extract_location(self, soup: BeautifulSoup) -> str:
        """Extract job location."""
        for selector in [
            "div[class*='location']", "span[class*='location']",
            "div[data-testid*='location']",
        ]:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(strip=True)
                if text and len(text) < 100:
                    return text
        return ""

    def _extract_description(self, soup: BeautifulSoup) -> str:
        """Extract job description."""
        for selector in [
            "div[class*='description']", "div[class*='job-desc']",
            "div[id*='description']", "section[class*='description']",
            "div.jobDescriptionContent",
        ]:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(separator="\n", strip=True)
                if text and len(text) > 50:
                    return text[:3000]

        # Fallback: grab main content
        main = soup.select_one("main, article, div[role='main']")
        if main:
            return main.get_text(separator="\n", strip=True)[:3000]
        return ""


# Module-level singleton
job_parser = JobParser()
