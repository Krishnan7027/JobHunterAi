"""Strict contact verification layer.

RULES:
- Contact stored ONLY IF email is explicitly present OR public profile exists
- REQUIRED: source_url, extraction_type
- VERIFIED = true only if explicitly found
- Reject: duplicates, missing source, inferred data
"""

from __future__ import annotations

import logging
import re

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


class ContactVerifier:
    """Strict trust layer for contact data.

    Only passes contacts that meet all verification criteria.
    """

    def verify(self, contact: dict, source_text: str = "") -> dict | None:
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
                # Re-check: if no email either, reject entirely
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
            result = self.verify(contact, source_text)
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


# Module-level singleton
contact_verifier = ContactVerifier()
