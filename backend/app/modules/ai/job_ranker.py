"""Job Ranking AI — scores jobs against user profile using Gemini.

Ranks each job 0-100 based on skill match, experience fit, and domain alignment.
Caches results to avoid duplicate Gemini calls. Ranks max 20 jobs per batch.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.modules.ai.gemini_client import gemini_client
from app.core.cache import cache_manager

logger = logging.getLogger(__name__)

MAX_RANK_BATCH = 20  # Limit to avoid quota exhaustion


def _format_experience_compact(experience: list[dict]) -> str:
    if not experience:
        return "Not provided"
    parts = []
    for exp in experience[:4]:
        title = exp.get("title", "")
        company = exp.get("company", "")
        years = exp.get("years", 0)
        if title:
            parts.append(f"{title} at {company} ({years}y)")
    return "; ".join(parts) if parts else "Not provided"


async def rank_job(profile: dict[str, Any], job: dict[str, Any]) -> dict[str, Any]:
    """Rank a single job against user profile.

    Returns dict with score, matched_skills, missing_skills, relevance, reason.
    """
    fallback = {
        "score": 0,
        "matched_skills": [],
        "missing_skills": [],
        "relevance": "low",
        "reason": "Ranking unavailable",
    }

    skills = profile.get("skills", [])
    if not skills:
        return {**fallback, "reason": "No skills in profile"}

    job_title = job.get("title", "")
    company = job.get("company", "")
    description = job.get("description", "") or ""

    # Cache by profile skills hash + job title + company
    cache_key = cache_manager.hash_key(
        "rank",
        ",".join(sorted(skills[:8])),
        job_title,
        company,
    )

    # Check cache
    cached = cache_manager.get(cache_key)
    if cached:
        import json
        try:
            return json.loads(cached)
        except Exception:
            pass

    prompt = gemini_client.load_prompt(
        "job_ranking",
        skills=", ".join(skills),
        experience=_format_experience_compact(profile.get("experience", [])),
        domains=", ".join(profile.get("domains", [])),
        job_title=job_title,
        company=company,
        description=description[:1500],
    )

    if not prompt:
        return fallback

    try:
        result = await gemini_client.generate_json(prompt, max_tokens=512)

        if not result or not isinstance(result, dict):
            return fallback

        ranking = {
            "score": min(100, max(0, int(result.get("score", 0)))),
            "matched_skills": list(result.get("matched_skills", [])),
            "missing_skills": list(result.get("missing_skills", [])),
            "relevance": str(result.get("relevance", "low")),
            "reason": str(result.get("reason", "")),
        }

        # Cache result
        import json
        cache_manager.set(cache_key, json.dumps(ranking), expire=3600)

        return ranking

    except Exception as exc:
        exc_str = str(exc).lower()
        if "429" in exc_str or "quota" in exc_str:
            logger.warning("Gemini quota hit during ranking")
            return {**fallback, "reason": "AI quota exceeded"}
        logger.error("Job ranking failed: %s", exc)
        return fallback


async def rank_jobs(
    profile: dict[str, Any],
    jobs: list[dict[str, Any]],
    max_rank: int = MAX_RANK_BATCH,
) -> list[dict[str, Any]]:
    """Rank multiple jobs and sort by score DESC.

    Only ranks top `max_rank` jobs to conserve API quota.
    Returns jobs with ranking fields attached.
    """
    if not jobs:
        return []

    to_rank = jobs[:max_rank]
    logger.info("Ranking %d jobs (of %d total) against profile", len(to_rank), len(jobs))

    # Run rankings concurrently (but Gemini rate limiter handles throttling)
    tasks = [rank_job(profile, job) for job in to_rank]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    ranked: list[dict] = []
    for job, result in zip(to_rank, results):
        if isinstance(result, Exception):
            logger.error("Ranking error for '%s': %s", job.get("title", ""), result)
            ranking = {"score": 0, "matched_skills": [], "missing_skills": [], "relevance": "low", "reason": "Error"}
        else:
            ranking = result

        ranked.append({**job, **ranking})

    # Add unranked jobs at the end
    for job in jobs[max_rank:]:
        ranked.append({**job, "score": 0, "relevance": "unranked", "matched_skills": [], "missing_skills": [], "reason": "Not ranked (limit)"})

    # Sort by score DESC
    ranked.sort(key=lambda j: j.get("score", 0), reverse=True)

    scores = [j.get("score", 0) for j in ranked[:10]]
    logger.info("Ranking complete. Top scores: %s", scores)

    return ranked
