"""Consolidated AI service module.

Combines CV parsing, job matching, content generation, and matching engine
into a single AIService class with all AI-powered functionality.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from functools import partial
from pathlib import Path
from typing import Any

import docx
import PyPDF2

from app.modules.ai.gemini_client import gemini_client
from app.core.cache import cache_manager

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# File extraction helpers
# ---------------------------------------------------------------------------

def _extract_pdf_sync(file_path: str) -> str:
    reader = PyPDF2.PdfReader(file_path)
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n".join(pages)


def _extract_docx_sync(file_path: str) -> str:
    doc = docx.Document(file_path)
    return "\n".join(p.text for p in doc.paragraphs if p.text)


async def parse_pdf(file_path: str) -> str:
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, partial(_extract_pdf_sync, file_path))
    except Exception as exc:
        logger.error("PDF extraction failed '%s': %s", file_path, exc)
        return ""


async def parse_docx(file_path: str) -> str:
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, partial(_extract_docx_sync, file_path))
    except Exception as exc:
        logger.error("DOCX extraction failed '%s': %s", file_path, exc)
        return ""


def _file_hash(file_path: str) -> str:
    """SHA256 hash of file content for cache key."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()[:32]


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


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_EMPTY_PROFILE: dict[str, Any] = {
    "name": "",
    "email": "",
    "phone": "",
    "summary": "",
    "skills": [],
    "experience": [],
    "education": [],
    "tools": [],
    "domains": [],
    "total_years_experience": 0,
}

_MATCH_FALLBACK: dict[str, Any] = {
    "skill_match_pct": 0.0,
    "experience_match": 0.0,
    "overall_score": 0.0,
    "priority_score": 0.0,
    "matched_skills": [],
    "missing_skills": [],
    "reasoning": "Scoring failed",
}


# ---------------------------------------------------------------------------
# AIService — consolidated class
# ---------------------------------------------------------------------------

class AIService:
    """Unified AI service combining CV parsing, job matching, and content generation."""

    # ------------------------------------------------------------------
    # CV Parsing
    # ------------------------------------------------------------------

    async def parse_cv(self, file_path: str) -> dict[str, Any]:
        """Parse CV: detect format, extract text, call Gemini.

        Results cached by file content hash -- re-uploading same file skips API call.
        """
        path = Path(file_path)
        if not path.exists():
            logger.error("CV file not found: %s", file_path)
            return {**_EMPTY_PROFILE}

        ext = path.suffix.lower()
        if ext == ".pdf":
            raw_text = await parse_pdf(file_path)
        elif ext in {".docx", ".doc"}:
            raw_text = await parse_docx(file_path)
        else:
            logger.error("Unsupported CV format: %s", ext)
            return {**_EMPTY_PROFILE}

        if not raw_text.strip():
            logger.error("No text extracted from CV: %s", file_path)
            return {**_EMPTY_PROFILE}

        logger.info("CV text extracted: %d chars from %s", len(raw_text), path.name)

        # Cache by file content hash
        file_hash = _file_hash(file_path)
        cache_key = f"cv_parse:{file_hash}"

        prompt = gemini_client.load_prompt("cv_parse", cv_text=raw_text[:8000])
        if not prompt:
            return {**_EMPTY_PROFILE, "raw_text": raw_text}

        try:
            parsed = await gemini_client.generate_json(prompt, cache_key=cache_key)
        except Exception as exc:
            exc_str = str(exc).lower()
            if "429" in exc_str or "quota" in exc_str:
                logger.error("Gemini quota exceeded — CV text saved but AI parsing skipped")
                return {**_EMPTY_PROFILE, "raw_text": raw_text, "_error": "Gemini API quota exceeded. Try again later."}
            logger.error("Gemini CV parse failed: %s", exc)
            return {**_EMPTY_PROFILE, "raw_text": raw_text, "_error": str(exc)}

        if not parsed or not isinstance(parsed, dict):
            logger.warning("Gemini returned empty result for CV: %s", file_path)
            return {**_EMPTY_PROFILE, "raw_text": raw_text}

        logger.info("CV parsed successfully: %d skills, %d experience entries",
                     len(parsed.get("skills", [])), len(parsed.get("experience", [])))

        result = {**_EMPTY_PROFILE, **parsed, "raw_text": raw_text}
        return result

    async def extract_text(self, file_path: str) -> str:
        """Extract raw text from PDF or DOCX file."""
        ext = Path(file_path).suffix.lower()
        if ext == ".pdf":
            return await parse_pdf(file_path)
        if ext in {".docx", ".doc"}:
            return await parse_docx(file_path)
        return ""

    # ------------------------------------------------------------------
    # Job Matching (Gemini AI)
    # ------------------------------------------------------------------

    async def score_job(self, profile: dict, job: dict) -> dict:
        """Score how well a candidate profile matches a job.

        Uses cached results when available to minimize Gemini API calls.
        """
        try:
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
                return {**_MATCH_FALLBACK}

            result = await gemini_client.generate_json(prompt, cache_key=cache_key)
            if not result or not isinstance(result, dict):
                return {**_MATCH_FALLBACK}

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
            logger.error("Failed to score job '%s': %s", job.get("title"), exc)
            return {**_MATCH_FALLBACK}

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

    # ------------------------------------------------------------------
    # Local Scoring (no AI call)
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Content Generation — Cover Letters & Resumes
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Content Generation — Application Answers
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Outreach — Cold Email
    # ------------------------------------------------------------------

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
            result = await gemini_client.generate_json(prompt, max_tokens=1024)
            if isinstance(result, dict) and result.get("subject") and result.get("body"):
                return {"subject": result["subject"], "body": result["body"]}
            return {}
        except Exception as exc:
            logger.error("Cold email generation failed: %s", exc)
            return {}

    # ------------------------------------------------------------------
    # Outreach — Follow-up Email
    # ------------------------------------------------------------------

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
            result = await gemini_client.generate_json(prompt, max_tokens=512)
            if isinstance(result, dict) and result.get("body"):
                return {
                    "subject": result.get("subject", f"Re: {job.get('title', '')}"),
                    "body": result["body"],
                }
            return {}
        except Exception as exc:
            logger.error("Followup email generation failed: %s", exc)
            return {}

    # ------------------------------------------------------------------
    # Outreach — LinkedIn Message
    # ------------------------------------------------------------------

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
            result = await gemini_client.generate_json(prompt, max_tokens=256)
            if isinstance(result, dict):
                return result.get("message", "")
            return ""
        except Exception as exc:
            logger.error("LinkedIn message generation failed: %s", exc)
            return ""


    # ------------------------------------------------------------------
    # Profile Analysis
    # ------------------------------------------------------------------

    async def analyze_profile(self, profile: dict[str, Any]) -> dict[str, Any]:
        """Analyze a candidate profile — strengths, weaknesses, skill gaps, role recommendations.

        Returns structured analysis dict. Falls back to safe defaults on failure.
        """
        fallback = {
            "strengths": ["Profile data available"],
            "weaknesses": ["Analysis unavailable — try again later"],
            "recommended_roles": [],
            "skill_gaps": [],
            "career_summary": "",
            "experience_level": "unknown",
        }

        skills = profile.get("skills", [])
        if not skills:
            logger.warning("Cannot analyze profile: no skills found")
            fallback["weaknesses"] = ["No skills in profile — upload CV first"]
            return fallback

        experience = profile.get("experience", [])
        total_years = 0
        if isinstance(experience, list):
            total_years = sum(e.get("years", 0) for e in experience if isinstance(e, dict))

        cache_key = cache_manager.hash_key(
            "profile_analysis",
            ",".join(sorted(skills[:10])),
            str(total_years),
        )

        prompt = gemini_client.load_prompt(
            "profile_analysis",
            candidate_name=profile.get("name", "Candidate"),
            skills=", ".join(skills),
            tools=", ".join(profile.get("tools", [])),
            domains=", ".join(profile.get("domains", [])),
            experience=_format_experience(experience),
            education=str(profile.get("education", [])),
            total_years=total_years,
        )

        if not prompt:
            logger.error("Failed to load profile_analysis prompt")
            return fallback

        logger.info("Analyzing profile: %d skills, %d experience entries, %d years",
                     len(skills), len(experience), total_years)

        try:
            result = await gemini_client.generate_json(prompt, cache_key=cache_key)

            if not result or not isinstance(result, dict):
                logger.warning("Gemini returned empty profile analysis")
                return fallback

            logger.info("Profile analysis: %d strengths, %d gaps, %d roles",
                        len(result.get("strengths", [])),
                        len(result.get("skill_gaps", [])),
                        len(result.get("recommended_roles", [])))

            return {
                "strengths": list(result.get("strengths", [])),
                "weaknesses": list(result.get("weaknesses", [])),
                "recommended_roles": list(result.get("recommended_roles", [])),
                "skill_gaps": list(result.get("skill_gaps", [])),
                "career_summary": str(result.get("career_summary", "")),
                "experience_level": str(result.get("experience_level", "unknown")),
            }

        except Exception as exc:
            exc_str = str(exc).lower()
            if "429" in exc_str or "quota" in exc_str:
                logger.error("Gemini quota exceeded during profile analysis")
                fallback["weaknesses"] = ["Gemini API quota exceeded — try again later"]
            else:
                logger.error("Profile analysis failed: %s", exc)
            return fallback


# Module-level singleton
ai_service = AIService()
