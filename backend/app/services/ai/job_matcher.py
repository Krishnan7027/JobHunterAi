"""Job matching service using Gemini AI.

Takes structured CV JSON and job description, returns match score.
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.ai.gemini_client import gemini_client
from app.services.cache import cache_manager

logger = logging.getLogger(__name__)

_FALLBACK = {
    "skill_match_pct": 0.0,
    "experience_match": 0.0,
    "overall_score": 0.0,
    "priority_score": 0.0,
    "matched_skills": [],
    "missing_skills": [],
    "reasoning": "Scoring failed",
}


class JobMatcher:
    """Matches CV profiles against job descriptions using Gemini."""

    async def match(
        self,
        cv_json: dict[str, Any],
        job: dict[str, Any],
    ) -> dict[str, Any]:
        """Score CV against job description.

        Args:
            cv_json: Structured CV data with skills, tools, domains, total_years_experience.
            job: Job dict with title, company, description, requirements.

        Returns:
            Dict with score, matched_skills, missing_skills, reasoning.
        """
        cache_key = cache_manager.hash_key(
            "match",
            ",".join(sorted(cv_json.get("skills", []))),
            job.get("title", ""),
            job.get("company", ""),
        )

        prompt = gemini_client.load_prompt(
            "job_match",
            skills=", ".join(cv_json.get("skills", [])),
            tools=", ".join(cv_json.get("tools", [])),
            domains=", ".join(cv_json.get("domains", [])),
            total_years=cv_json.get("total_years_experience", 0),
            job_title=job.get("title", ""),
            company=job.get("company", ""),
            description=(job.get("description", "") or "")[:2000],
            requirements=str(job.get("requirements", "")),
        )

        if not prompt:
            return {**_FALLBACK}

        try:
            result = await gemini_client.generate_json(
                prompt, cache_key=cache_key
            )
            if not result or not isinstance(result, dict):
                return {**_FALLBACK}

            return {
                "score": float(result.get("overall_score", 0.0)),
                "skill_match_pct": float(result.get("skill_match_pct", 0.0)),
                "experience_match": float(result.get("experience_match", 0.0)),
                "overall_score": float(result.get("overall_score", 0.0)),
                "priority_score": float(result.get("priority_score", 0.0)),
                "matched_skills": list(result.get("matched_skills", [])),
                "missing_skills": list(result.get("missing_skills", [])),
                "reasoning": str(result.get("reasoning", "")),
            }
        except Exception as exc:
            logger.error("Job match failed: %s", exc)
            return {**_FALLBACK}


# Module-level singleton
job_matcher = JobMatcher()
