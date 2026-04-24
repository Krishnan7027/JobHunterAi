"""Gemini AI service wrapper with async support, retry logic, and rate limiting."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any

import google.generativeai as genai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import settings
from app.services.cache import cache_manager

logger = logging.getLogger(__name__)

# Prompt templates directory
PROMPTS_DIR = Path(__file__).parent / "prompts"


def _load_prompt(name: str) -> str:
    """Load a prompt template from .md file."""
    path = PROMPTS_DIR / f"{name}.md"
    if not path.exists():
        logger.error("Prompt template not found: %s", path)
        return ""
    return path.read_text(encoding="utf-8").strip()


class GeminiClient:
    """Async wrapper around Google Gemini API with rate limiting and caching.

    Uses GEMINI_API_KEY from environment. Targets gemini-2.0-flash (free tier).
    Free tier limits: 15 RPM, 1M TPM, 1500 RPD.
    """

    def __init__(self) -> None:
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel(settings.gemini_model)
        self._request_times: list[float] = []
        self._lock = asyncio.Lock()
        self._rpm_limit = settings.gemini_rpm_limit

    async def _rate_limit(self) -> None:
        """Enforce Gemini free tier rate limit (15 RPM)."""
        async with self._lock:
            now = time.monotonic()
            # Remove requests older than 60 seconds
            self._request_times = [
                t for t in self._request_times if now - t < 60.0
            ]
            if len(self._request_times) >= self._rpm_limit:
                oldest = self._request_times[0]
                wait_time = 60.0 - (now - oldest) + 0.5
                if wait_time > 0:
                    logger.info("Gemini rate limit: waiting %.1fs", wait_time)
                    await asyncio.sleep(wait_time)
            self._request_times.append(time.monotonic())

    @retry(
        retry=retry_if_exception_type((Exception,)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=30),
        reraise=True,
    )
    async def generate(
        self,
        prompt: str,
        max_tokens: int = 4096,
        cache_key: str | None = None,
        temperature: float = 0.3,
    ) -> str:
        """Send prompt to Gemini and return plain-text response.

        Args:
            prompt: The prompt text.
            max_tokens: Maximum output tokens.
            cache_key: Optional cache key. If provided, cached result returned if available.

        Returns:
            Response text, or empty string on failure.
        """
        # Check cache first
        if cache_key:
            cached = cache_manager.get(cache_key)
            if cached is not None:
                logger.debug("Cache hit for key: %s", cache_key)
                return cached

        await self._rate_limit()

        try:
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=max_tokens,
                        temperature=temperature,
                    ),
                ),
            )

            if not response or not response.text:
                logger.warning("Gemini returned empty response")
                return ""

            text = response.text

            # Cache the result
            if cache_key:
                cache_manager.set(cache_key, text, expire=3600)

            return text

        except Exception as exc:
            # Check for rate limit errors specifically
            exc_str = str(exc).lower()
            if "429" in exc_str or "rate" in exc_str or "quota" in exc_str:
                logger.warning("Gemini rate limited, will retry: %s", exc)
                raise  # Let tenacity retry
            logger.error("Gemini generation failed: %s", exc)
            raise

    async def generate_json(
        self,
        prompt: str,
        max_tokens: int = 4096,
        cache_key: str | None = None,
    ) -> dict[str, Any] | list[Any]:
        """Generate a response and parse it as JSON.

        Handles markdown code-fence wrappers that Gemini sometimes adds.
        Returns empty dict when parsing fails.
        """
        try:
            text = await self.generate(prompt, max_tokens, cache_key)
            if not text:
                return {}

            cleaned = _strip_code_fences(text)
            return json.loads(cleaned)
        except (json.JSONDecodeError, ValueError) as exc:
            logger.error("Failed to parse JSON from Gemini response: %s", exc)
            return {}
        except Exception as exc:
            logger.error("Gemini JSON generation failed: %s", exc)
            return {}

    async def batch_generate(
        self,
        prompts: list[str],
        max_tokens: int = 4096,
        temperature: float = 0.3,
    ) -> list[str]:
        """Generate responses for multiple prompts sequentially (rate-limit safe).

        Processes one at a time to stay within Gemini free tier RPM.
        Returns list of response strings in same order as input prompts.
        Empty string for any failed prompt.
        """
        results: list[str] = []
        for i, prompt in enumerate(prompts):
            try:
                text = await self.generate(prompt, max_tokens)
                results.append(text)
            except Exception as exc:
                logger.error("Batch prompt %d failed: %s", i, exc)
                results.append("")
        return results

    def load_prompt(self, name: str, **kwargs: Any) -> str:
        """Load and format a prompt template.

        Args:
            name: Template name (without .md extension).
            **kwargs: Format parameters for the template.

        Returns:
            Formatted prompt string.
        """
        template = _load_prompt(name)
        if not template:
            return ""
        try:
            return template.format(**kwargs)
        except KeyError as exc:
            logger.error("Missing prompt parameter: %s for template '%s'", exc, name)
            return template


def _strip_code_fences(text: str) -> str:
    """Remove optional markdown code fences (```json ... ```) from text."""
    stripped = text.strip()
    if stripped.startswith("```"):
        first_newline = stripped.index("\n")
        stripped = stripped[first_newline + 1:]
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    return stripped.strip()


# Module-level singleton
gemini_client = GeminiClient()
