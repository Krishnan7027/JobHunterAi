"""CV/resume parsing service.

Extracts text from PDF/DOCX, sends to Gemini for structured extraction.
Results cached by file content hash to avoid duplicate API calls.
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

from app.services.ai.gemini_client import gemini_client
from app.services.cache import cache_manager

logger = logging.getLogger(__name__)

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


async def parse_cv(file_path: str) -> dict[str, Any]:
    """Parse CV: detect format, extract text, call Gemini.

    Results cached by file content hash — re-uploading same file skips API call.
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

    # Cache by file content hash
    file_hash = _file_hash(file_path)
    cache_key = f"cv_parse:{file_hash}"

    prompt = gemini_client.load_prompt("cv_parse", cv_text=raw_text)
    if not prompt:
        return {**_EMPTY_PROFILE, "raw_text": raw_text}

    parsed = await gemini_client.generate_json(prompt, cache_key=cache_key)

    if not parsed or not isinstance(parsed, dict):
        logger.warning("Gemini returned empty result for CV: %s", file_path)
        return {**_EMPTY_PROFILE, "raw_text": raw_text}

    result = {**_EMPTY_PROFILE, **parsed, "raw_text": raw_text}
    return result


class CVParserService:
    """Class wrapper for backward compatibility."""

    async def extract_text(self, file_path: str) -> str:
        ext = Path(file_path).suffix.lower()
        if ext == ".pdf":
            return await parse_pdf(file_path)
        if ext in {".docx", ".doc"}:
            return await parse_docx(file_path)
        return ""

    async def parse_cv(self, file_path: str) -> dict[str, Any]:
        return await parse_cv(file_path)


cv_parser = CVParserService()
CVParser = CVParserService
