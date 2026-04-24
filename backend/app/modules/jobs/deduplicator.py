"""Job deduplication module.

Removes duplicate jobs across Indeed, Google, Naukri, and multiple scrapes.
Uses normalized title+company+location hash for exact dedup.
"""

from __future__ import annotations

import hashlib
import logging
import re

logger = logging.getLogger(__name__)


def normalize(text: str) -> str:
    """Lowercase, strip special chars, collapse whitespace."""
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)  # Remove special chars
    text = re.sub(r"\s+", " ", text)  # Collapse whitespace
    return text


def job_hash(job: dict) -> str:
    """Generate deterministic hash from title + company + location."""
    parts = "|".join([
        normalize(job.get("title", "")),
        normalize(job.get("company", "")),
        normalize(job.get("location", "")),
    ])
    return hashlib.sha256(parts.encode()).hexdigest()[:16]


def deduplicate_jobs(jobs: list[dict]) -> list[dict]:
    """Remove duplicate jobs using title+company+location hash + URL dedup.

    Returns deduplicated list preserving order (first occurrence wins).
    """
    seen_hashes: set[str] = set()
    seen_urls: set[str] = set()
    unique: list[dict] = []
    dupes_removed = 0

    for job in jobs:
        # URL dedup
        url = job.get("apply_url", "")
        if url and url in seen_urls:
            dupes_removed += 1
            continue

        # Content hash dedup
        h = job_hash(job)
        if h in seen_hashes:
            dupes_removed += 1
            continue

        if url:
            seen_urls.add(url)
        seen_hashes.add(h)
        unique.append(job)

    if dupes_removed:
        logger.info("Dedup: removed %d duplicates, %d → %d unique", dupes_removed, len(jobs), len(unique))

    return unique
