"""Contacts module service layer.

Consolidates contact extraction and verification logic.

STRICT RULES:
- Extract ONLY explicitly present contact info
- NEVER guess or generate emails
- Cross-validate AI results with regex
- Every contact MUST have source_url as proof
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.modules.ai.gemini_client import gemini_client

logger = logging.getLogger(__name__)

_EMAIL_PATTERN = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
)

# Common non-person email patterns to reject
_NOREPLY_PATTERNS = {
    "noreply", "no-reply", "donotreply", "do-not-reply",
    "mailer-daemon", "postmaster", "abuse", "webmaster",
    "info@", "support@", "contact@", "admin@", "sales@",
    "hello@", "team@",
}

VALID_EXTRACTION_TYPES = {"job_posting", "company_page", "public_profile"}


class ContactService:
    """Extracts, verifies, and deduplicates contact information.

    Uses both regex (for emails) and Gemini AI (for structured extraction).
    All results go through strict verification before being returned.
    """

    # ── Extraction ──────────────────────────────────────────

    async def extract_from_text(
        self,
        text: str,
        source_url: str,
        extraction_type: str = "job_posting",
    ) -> list[dict]:
        """Extract contacts from text using regex + AI.

        Args:
            text: Raw text to extract from.
            source_url: URL where text was found. REQUIRED.
            extraction_type: One of: job_posting, company_page, public_profile.

        Returns:
            List of verified contact dicts.
        """
        if not text or not text.strip():
            return []
        if not source_url:
            logger.error("source_url is required for contact extraction")
            return []

        # Step 1: Regex extraction (ground truth)
        regex_emails = self._extract_emails_regex(text)

        # Step 2: AI extraction for structured data (name, role, company)
        ai_contacts = await self._ai_extract(text, source_url)

        # Step 3: Merge regex and AI results
        merged = self._merge_results(regex_emails, ai_contacts, source_url, extraction_type)

        # Step 4: Strict verification
        verified = self.verify_batch(merged, source_text=text)

        return verified

    async def extract_from_html(
        self,
        html: str,
        source_url: str,
        extraction_type: str = "job_posting",
    ) -> list[dict]:
        """Extract contacts from HTML content."""
        text = _strip_html(html)
        return await self.extract_from_text(text, source_url, extraction_type)

    # ── Verification ────────────────────────────────────────

    def verify_contact(self, contact: dict, source_text: str = "") -> dict | None:
        """Verify a single contact against strict rules.

        Args:
            contact: Raw contact dict from extraction.
            source_text: Original text where contact was found (for cross-validation).

        Returns:
            Verified contact dict with 'verified' field set, or None if rejected.
        """
        # RULE: source_url is REQUIRED
        if not contact.get("source_url"):
            logger.warning("Rejected contact: missing source_url")
            return None

        # RULE: extraction_type must be valid
        extraction_type = contact.get("extraction_type", "")
        if extraction_type not in VALID_EXTRACTION_TYPES:
            logger.warning("Rejected contact: invalid extraction_type '%s'", extraction_type)
            return None

        email = contact.get("email")
        profile_url = contact.get("profile_url")

        # RULE: Must have explicit email OR public profile
        if not email and not profile_url:
            logger.debug("Rejected contact: no email and no profile_url")
            return None

        # Cross-validate email against source text
        if email:
            email = email.strip().lower()
            if not _EMAIL_PATTERN.match(email):
                logger.warning("Rejected contact: invalid email format '%s'", email)
                return None

            # Reject noreply/generic emails
            if any(pattern in email.lower() for pattern in _NOREPLY_PATTERNS):
                logger.debug("Rejected generic email: %s", email)
                return None

            # Cross-validate: email must appear in source text
            if source_text and email not in source_text.lower():
                logger.warning(
                    "Rejected contact: email '%s' not found in source text (hallucination)",
                    email,
                )
                return None

            contact["email"] = email

        # Validate profile_url
        if profile_url:
            if not profile_url.startswith("http"):
                logger.warning("Rejected contact: invalid profile_url '%s'", profile_url)
                contact["profile_url"] = None
                if not email:
                    return None

        # Set verified status
        contact["verified"] = True

        # Ensure required fields have defaults
        contact.setdefault("name", None)
        contact.setdefault("role", None)
        contact.setdefault("company", None)
        contact.setdefault("email", None)
        contact.setdefault("profile_url", None)

        return contact

    def verify_batch(
        self,
        contacts: list[dict],
        source_text: str = "",
    ) -> list[dict]:
        """Verify a batch of contacts, rejecting duplicates.

        Args:
            contacts: List of raw contact dicts.
            source_text: Original source text for cross-validation.

        Returns:
            List of verified, deduplicated contacts.
        """
        verified: list[dict] = []
        seen_emails: set[str] = set()
        seen_profiles: set[str] = set()

        for contact in contacts:
            result = self.verify_contact(contact, source_text)
            if result is None:
                continue

            # Deduplicate by email
            email = result.get("email")
            if email:
                if email in seen_emails:
                    logger.debug("Duplicate email skipped: %s", email)
                    continue
                seen_emails.add(email)

            # Deduplicate by profile_url
            profile = result.get("profile_url")
            if profile:
                if profile in seen_profiles:
                    logger.debug("Duplicate profile skipped: %s", profile)
                    continue
                seen_profiles.add(profile)

            verified.append(result)

        logger.info(
            "Verification: %d/%d contacts passed",
            len(verified), len(contacts),
        )
        return verified

    # ── Private helpers ─────────────────────────────────────

    async def _ai_extract(self, text: str, source_url: str) -> list[dict]:
        """Use Gemini to extract structured contact data."""
        try:
            prompt = gemini_client.load_prompt(
                "contact_extract",
                text=text[:5000],
                source_url=source_url,
            )
            if not prompt:
                return []

            cache_key = f"contact:{hash(text[:500])}"
            result = await gemini_client.generate_json(prompt, cache_key=cache_key)

            if isinstance(result, list):
                return result
            if isinstance(result, dict):
                return [result]
            return []

        except Exception as exc:
            logger.error("AI contact extraction failed: %s", exc)
            return []

    def _extract_emails_regex(self, text: str) -> list[str]:
        """Find all email addresses explicitly in text."""
        if not text:
            return []
        matches = _EMAIL_PATTERN.findall(text)
        seen: set[str] = set()
        unique: list[str] = []
        for email in matches:
            lower = email.lower()
            if lower not in seen:
                seen.add(lower)
                unique.append(email)
        return unique

    def _merge_results(
        self,
        regex_emails: list[str],
        ai_contacts: list[dict],
        source_url: str,
        extraction_type: str,
    ) -> list[dict]:
        """Merge regex emails with AI-extracted structured contacts.

        AI emails that don't match regex findings are REMOVED (anti-hallucination).
        Regex emails not in AI results are added as standalone contacts.
        """
        contacts: list[dict] = []
        ai_matched_emails: set[str] = set()

        # Process AI contacts, cross-validate emails
        for ac in ai_contacts:
            ac["source_url"] = source_url
            ac["extraction_type"] = extraction_type

            ai_email = ac.get("email")
            if ai_email:
                ai_email_lower = ai_email.lower()
                if ai_email_lower in {e.lower() for e in regex_emails}:
                    ai_matched_emails.add(ai_email_lower)
                else:
                    logger.warning(
                        "Removing AI-hallucinated email '%s' (not in source text)",
                        ai_email,
                    )
                    ac["email"] = None

            contacts.append(ac)

        # Add regex emails not captured by AI
        for email in regex_emails:
            if email.lower() not in ai_matched_emails:
                contacts.append({
                    "name": None,
                    "role": None,
                    "company": None,
                    "email": email,
                    "profile_url": None,
                    "source_url": source_url,
                    "extraction_type": extraction_type,
                })

        return contacts


def _strip_html(html: str) -> str:
    """Remove HTML tags and normalize whitespace."""
    if not html:
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# Module-level singleton
contact_service = ContactService()
