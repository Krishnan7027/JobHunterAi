"""AI content generation service for job applications.

Generates cover letters, tailored resumes, and application answers
using Gemini API with caching and token optimization.
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.ai.gemini_client import gemini_client
from app.services.cache import cache_manager

logger = logging.getLogger(__name__)


class ContentGenerator:
    """Generates application materials using Gemini AI."""

    async def generate_cover_letter(
        self,
        profile: dict[str, Any],
        job: dict[str, Any],
    ) -> str:
        """Generate a tailored cover letter.

        Args:
            profile: Parsed candidate profile.
            job: Job posting dict.

        Returns:
            Cover letter text, or empty string on failure.
        """
        cache_key = cache_manager.hash_key(
            "cover_letter",
            profile.get("name", ""),
            ",".join(sorted(profile.get("skills", [])[:5])),
            job.get("title", ""),
            job.get("company", ""),
        )

        prompt = gemini_client.load_prompt(
            "cover_letter",
            name=profile.get("name", "Candidate"),
            skills=", ".join(profile.get("skills", [])),
            experience=_format_experience(profile.get("experience", [])),
            domains=", ".join(profile.get("domains", [])),
            job_title=job.get("title", ""),
            company=job.get("company", ""),
            description=(job.get("description", "") or "")[:2000],
        )

        if not prompt:
            return ""

        try:
            return await gemini_client.generate(
                prompt, max_tokens=2048, cache_key=cache_key, temperature=0.5
            )
        except Exception as exc:
            logger.error("Cover letter generation failed: %s", exc)
            return ""

    async def generate_tailored_resume(
        self,
        profile: dict[str, Any],
        job: dict[str, Any],
    ) -> str:
        """Generate a tailored resume."""
        cache_key = cache_manager.hash_key(
            "resume",
            profile.get("name", ""),
            job.get("title", ""),
            job.get("company", ""),
        )

        prompt = gemini_client.load_prompt(
            "resume_tailor",
            resume_text=profile.get("raw_text", "") or str(profile.get("skills", [])),
            job_title=job.get("title", ""),
            company=job.get("company", ""),
            description=(job.get("description", "") or "")[:2000],
            requirements=", ".join(job.get("requirements", [])),
        )

        if not prompt:
            return ""

        try:
            return await gemini_client.generate(
                prompt, max_tokens=3000, cache_key=cache_key, temperature=0.4
            )
        except Exception as exc:
            logger.error("Resume tailoring failed: %s", exc)
            return ""

    async def generate_application_answers(
        self,
        profile: dict[str, Any],
        job: dict[str, Any],
        questions: list[str],
    ) -> list[dict[str, str]]:
        """Generate answers to application questions.

        Args:
            profile: Candidate profile.
            job: Job posting dict.
            questions: List of application questions.

        Returns:
            List of {"question": str, "answer": str} dicts.
        """
        if not questions:
            return []

        prompt = gemini_client.load_prompt(
            "application_answers",
            name=profile.get("name", "Candidate"),
            skills=", ".join(profile.get("skills", [])),
            experience=_format_experience(profile.get("experience", [])),
            domains=", ".join(profile.get("domains", [])),
            job_title=job.get("title", ""),
            company=job.get("company", ""),
            description=(job.get("description", "") or "")[:1500],
            questions="\n".join(f"- {q}" for q in questions),
        )

        if not prompt:
            return []

        try:
            result = await gemini_client.generate_json(prompt, max_tokens=3000)
            if isinstance(result, dict):
                return result.get("answers", [])
            return []
        except Exception as exc:
            logger.error("Application answers generation failed: %s", exc)
            return []


    async def generate_cold_email(
        self,
        profile: dict[str, Any],
        job: dict[str, Any],
        recruiter: dict[str, Any] | None = None,
    ) -> dict[str, str]:
        """Generate high-conversion cold email.

        Returns {"subject": str, "body": str} or empty dict on failure.
        """
        prompt = gemini_client.load_prompt(
            "cold_email",
            candidate_name=profile.get("name", "Candidate"),
            skills=", ".join(profile.get("skills", [])[:8]),
            experience=_format_experience(profile.get("experience", [])),
            recruiter_name=(recruiter or {}).get("name", "Hiring Manager"),
            recruiter_role=(recruiter or {}).get("role", "Recruiter"),
            company=job.get("company", ""),
            job_title=job.get("title", ""),
            company_context=(job.get("description", "") or "")[:500],
        )

        if not prompt:
            return {}

        try:
            result = await gemini_client.generate_json(prompt, max_tokens=1024, temperature=0.6)
            if isinstance(result, dict) and result.get("subject") and result.get("body"):
                return {"subject": result["subject"], "body": result["body"]}
            return {}
        except Exception as exc:
            logger.error("Cold email generation failed: %s", exc)
            return {}

    async def generate_followup_email(
        self,
        profile: dict[str, Any],
        job: dict[str, Any],
        recruiter: dict[str, Any] | None = None,
        previous_date: str = "last week",
        new_value: str = "",
    ) -> dict[str, str]:
        """Generate follow-up email. Under 80 words.

        Returns {"subject": str, "body": str} or empty dict.
        """
        prompt = gemini_client.load_prompt(
            "followup_email",
            candidate_name=profile.get("name", "Candidate"),
            recruiter_name=(recruiter or {}).get("name", "Hiring Manager"),
            company=job.get("company", ""),
            job_title=job.get("title", ""),
            previous_date=previous_date,
            new_value=new_value or "Completed a relevant project",
        )

        if not prompt:
            return {}

        try:
            result = await gemini_client.generate_json(prompt, max_tokens=512, temperature=0.5)
            if isinstance(result, dict) and result.get("body"):
                return {
                    "subject": result.get("subject", f"Re: {job.get('title', '')}"),
                    "body": result["body"],
                }
            return {}
        except Exception as exc:
            logger.error("Followup email generation failed: %s", exc)
            return {}

    async def generate_linkedin_message(
        self,
        profile: dict[str, Any],
        job: dict[str, Any],
        recruiter: dict[str, Any] | None = None,
        connection_context: str = "",
    ) -> str:
        """Generate LinkedIn connection message. Under 50 words.

        Returns message string or empty string.
        """
        prompt = gemini_client.load_prompt(
            "linkedin_message",
            candidate_name=profile.get("name", "Candidate"),
            candidate_role=_format_experience(profile.get("experience", []))[:100],
            skills=", ".join(profile.get("skills", [])[:5]),
            recruiter_name=(recruiter or {}).get("name", ""),
            recruiter_role=(recruiter or {}).get("role", "Recruiter"),
            company=job.get("company", ""),
            connection_context=connection_context or f"Interested in {job.get('title', 'open roles')}",
        )

        if not prompt:
            return ""

        try:
            result = await gemini_client.generate_json(prompt, max_tokens=256, temperature=0.6)
            if isinstance(result, dict):
                return result.get("message", "")
            return ""
        except Exception as exc:
            logger.error("LinkedIn message generation failed: %s", exc)
            return ""


def _format_experience(experience: list[dict]) -> str:
    """Format experience list into compact string for prompts."""
    if not experience:
        return "Not provided"
    parts = []
    for exp in experience[:5]:  # Limit to top 5 for token efficiency
        title = exp.get("title", "")
        company = exp.get("company", "")
        duration = exp.get("duration", "")
        if title:
            parts.append(f"{title} at {company} ({duration})")
    return "; ".join(parts) if parts else "Not provided"


# Module-level singleton
content_generator = ContentGenerator()
