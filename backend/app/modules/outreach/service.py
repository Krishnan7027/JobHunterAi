"""Outreach message generator using Gemini AI."""

import logging

from app.modules.ai.gemini_client import gemini_client

logger = logging.getLogger(__name__)


class OutreachGenerator:
    """Generates personalized outreach messages for job applications."""

    async def generate_email(
        self, contact: dict, profile: dict, job: dict
    ) -> dict:
        """Generate outreach email. ONLY if contact has verified email."""
        if not contact.get("verified") or not contact.get("email"):
            logger.warning("Cannot generate email: no verified email for '%s'", contact.get("name"))
            return {}

        try:
            prompt = gemini_client.load_prompt(
                "outreach_email",
                recruiter_name=contact.get("name", "Hiring Manager"),
                recruiter_role=contact.get("role", "Recruiter"),
                company=contact.get("company") or job.get("company", ""),
                candidate_name=profile.get("name", ""),
                job_title=job.get("title", ""),
                skills=", ".join(profile.get("skills", [])[:10]),
            )

            result = await gemini_client.generate_json(prompt)
            if not result or not isinstance(result, dict):
                return {}

            subject = result.get("subject", "")
            body = result.get("body", "")
            if not subject or not body:
                return {}

            return {"subject": subject, "body": body}

        except Exception as exc:
            logger.error("Email generation failed: %s", exc)
            return {}

    async def generate_linkedin_message(
        self, contact: dict, profile: dict, job: dict
    ) -> str:
        """Generate LinkedIn template message. Does NOT automate LinkedIn."""
        try:
            prompt = gemini_client.load_prompt(
                "outreach_linkedin",
                recruiter_name=contact.get("name", "Hiring Manager"),
                recruiter_role=contact.get("role", "Recruiter"),
                company=contact.get("company") or job.get("company", ""),
                candidate_name=profile.get("name", ""),
                job_title=job.get("title", ""),
                skills=", ".join(profile.get("skills", [])[:10]),
            )

            result = await gemini_client.generate(prompt)
            return result.strip() if result else ""

        except Exception as exc:
            logger.error("LinkedIn message generation failed: %s", exc)
            return ""

    async def generate_followup(
        self, contact: dict, profile: dict, job: dict, previous_contact: str
    ) -> str:
        """Generate follow-up message."""
        try:
            prompt = gemini_client.load_prompt(
                "followup",
                company=contact.get("company") or job.get("company", ""),
                job_title=job.get("title", ""),
                applied_date=job.get("applied_date", "recently"),
                recruiter_name=contact.get("name", "Hiring Manager"),
                previous_contact=previous_contact,
            )

            result = await gemini_client.generate(prompt)
            return result.strip() if result else ""

        except Exception as exc:
            logger.error("Follow-up generation failed: %s", exc)
            return ""

    def recommend_outreach_path(self, contact: dict) -> str:
        """Recommend best outreach channel."""
        if contact.get("verified") and contact.get("email"):
            return "email"
        if contact.get("profile_url"):
            return "linkedin"
        return "apply_direct"


outreach_generator = OutreachGenerator()
