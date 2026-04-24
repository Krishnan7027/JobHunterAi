"""Job matching engine using Gemini AI and local heuristics."""

import asyncio
import logging

from app.services.ai.gemini_client import gemini_client
from app.services.cache import cache_manager

logger = logging.getLogger(__name__)


class MatchingEngine:
    """Scores candidate-job matches using Gemini AI + local Jaccard similarity."""

    async def score_job(self, profile: dict, job: dict) -> dict:
        """Score how well a candidate profile matches a job.

        Uses cached results when available to minimize Gemini API calls.
        """
        fallback = {
            "skill_match_pct": 0.0,
            "experience_match": 0.0,
            "overall_score": 0.0,
            "priority_score": 0.0,
            "matched_skills": [],
            "missing_skills": [],
            "reasoning": "Scoring failed",
        }

        try:
            # Cache key based on skills + job title + company
            cache_key = cache_manager.hash_key(
                "match",
                ",".join(sorted(profile.get("skills", []))),
                job.get("title", ""),
                job.get("company", ""),
            )

            prompt = gemini_client.load_prompt(
                "job_match",
                skills=", ".join(profile.get("skills", [])),
                tools=", ".join(profile.get("tools", [])),
                domains=", ".join(profile.get("domains", [])),
                total_years=profile.get("total_years_experience", 0),
                job_title=job.get("title", ""),
                company=job.get("company", ""),
                description=(job.get("description", "") or "")[:2000],
                requirements=str(job.get("requirements", "")),
            )

            if not prompt:
                return fallback

            result = await gemini_client.generate_json(prompt, cache_key=cache_key)
            if not result or not isinstance(result, dict):
                return fallback

            return {
                "skill_match_pct": float(result.get("skill_match_pct", 0.0)),
                "experience_match": float(result.get("experience_match", 0.0)),
                "overall_score": float(result.get("overall_score", 0.0)),
                "priority_score": float(result.get("priority_score", 0.0)),
                "matched_skills": list(result.get("matched_skills", [])),
                "missing_skills": list(result.get("missing_skills", [])),
                "reasoning": str(result.get("reasoning", "")),
            }

        except Exception as exc:
            logger.error("Failed to score job '%s': %s", job.get("title"), exc)
            return fallback

    async def batch_score(self, profile: dict, jobs: list[dict]) -> list[dict]:
        """Score multiple jobs concurrently."""
        if not jobs:
            return []

        tasks = [self.score_job(profile, job) for job in jobs]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        scored: list[dict] = []
        for job, result in zip(jobs, results):
            if isinstance(result, Exception):
                logger.error("Batch score failed for '%s': %s", job.get("title"), result)
                score = {
                    "skill_match_pct": 0.0, "experience_match": 0.0,
                    "overall_score": 0.0, "priority_score": 0.0,
                    "matched_skills": [], "missing_skills": [],
                    "reasoning": f"Error: {result}",
                }
            else:
                score = result
            scored.append({**job, **score})

        return scored

    def calculate_local_score(
        self,
        profile_skills: list[str],
        job_requirements: list[str],
    ) -> float:
        """Quick Jaccard similarity without AI call. Good for pre-filtering."""
        if not profile_skills or not job_requirements:
            return 0.0

        profile_set = {s.strip().lower() for s in profile_skills}
        job_set = {r.strip().lower() for r in job_requirements}

        intersection = profile_set & job_set
        union = profile_set | job_set

        if not union:
            return 0.0

        return round((len(intersection) / len(union)) * 100.0, 2)


# Module-level singleton
matching_engine = MatchingEngine()
