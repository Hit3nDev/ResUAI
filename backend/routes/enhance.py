"""routes/enhance.py — wraps enhance_resume() from ai_engine.py"""

import logging
import sys, os
from typing import Optional, List

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai_engine import enhance_resume, generate_cover_letter
from database import save_attempt, save_file, save_output_file, get_attempt_by_id
from downloads import download_response, safe_filename
from file_parser import extract_text_from_bytes
from config import GROQ_API_KEY   # loaded from env, never hardcoded

router = APIRouter()
log = logging.getLogger("resuai")


class EnhanceTextRequest(BaseModel):
    resume_text: str
    job_title: Optional[str] = ""
    job_description: Optional[str] = ""
    enhance_focus: Optional[List[str]] = []
    generate_cover_letter: Optional[bool] = False
    company_name: Optional[str] = ""
    cover_tone: Optional[str] = "Professional"


def _maybe_cover_letter(enabled: bool, resume_text: str, job_title: str, job_description: str,
                        company: str, tone: str, attempt_id: int):
    """Generate + persist a cover letter. Failures are logged and non-fatal."""
    if not enabled:
        return None
    jd = job_description or (f"Role: {job_title}" if job_title else "General application")
    try:
        letter = generate_cover_letter(GROQ_API_KEY, resume_text, jd, company or "", tone or "Professional")
        save_output_file(letter, "Enhanced_CoverLetter.txt", attempt_id=attempt_id)
        return letter
    except Exception:
        log.exception("Cover letter generation failed (non-fatal)")
        return None


def _run_enhance(text: str, job_title: str, job_description: str, focus: List[str]) -> str:
    try:
        return enhance_resume(GROQ_API_KEY, text, job_title or "", job_description or "", focus=focus or None)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")


@router.post("/text")
async def enhance_from_text(req: EnhanceTextRequest):
    if not req.resume_text.strip():
        raise HTTPException(status_code=422, detail="Resume text is required.")
    focus = req.enhance_focus or []
    enhanced = _run_enhance(req.resume_text, req.job_title, req.job_description, focus)

    attempt_id = save_attempt(
        feature="Enhance Resume",
        input_summary=f"Target: {req.job_title or 'General'} | {len(req.resume_text.split())} words",
        output_preview=enhanced[:300], full_output=enhanced,
        metadata={"job_title": req.job_title, "focus": focus},
    )
    save_output_file(enhanced, "Enhanced_Resume.txt", attempt_id=attempt_id)

    cover_letter = _maybe_cover_letter(
        bool(req.generate_cover_letter), enhanced, req.job_title or "", req.job_description or "",
        req.company_name or "", req.cover_tone or "Professional", attempt_id,
    )
    return {
        "enhanced_text": enhanced,
        "original_word_count": len(req.resume_text.split()),
        "enhanced_word_count": len(enhanced.split()),
        "attempt_id": attempt_id,
        "cover_letter": cover_letter,
    }


@router.post("/upload")
async def enhance_from_file(
    file: UploadFile = File(...),
    job_title: str = Form(""),
    job_description: str = Form(""),
    enhance_focus: str = Form(""),            # comma-joined list, e.g. "Stronger action verbs,Improve summary"
    generate_cover_letter: bool = Form(False),
    company_name: str = Form(""),
    cover_tone: str = Form("Professional"),
):
    contents = await file.read()
    try:
        text = extract_text_from_bytes(file.filename or "", contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"File parse error: {str(e)}")
    save_file(contents, safe_filename(file.filename, "resume"),
              file.content_type or "application/octet-stream", purpose="resume_input")

    focus = [f.strip() for f in enhance_focus.split(",") if f.strip()]
    enhanced = _run_enhance(text, job_title, job_description, focus)

    attempt_id = save_attempt(
        feature="Enhance Resume",
        input_summary=f"File: {file.filename} | {len(text.split())} words",
        output_preview=enhanced[:300], full_output=enhanced,
        metadata={"filename": file.filename, "job_title": job_title, "focus": focus},
    )
    save_output_file(enhanced, "Enhanced_Resume.txt", attempt_id=attempt_id)

    cover_letter = _maybe_cover_letter(
        generate_cover_letter, enhanced, job_title, job_description, company_name, cover_tone, attempt_id,
    )
    return {
        "enhanced_text": enhanced, "original_text": text, "attempt_id": attempt_id,
        "original_word_count": len(text.split()), "enhanced_word_count": len(enhanced.split()),
        "cover_letter": cover_letter,
    }


@router.get("/download/{attempt_id}/{format}")
async def download_enhanced(attempt_id: int, format: str):
    attempt = get_attempt_by_id(attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Not found")
    return download_response(attempt["full_output"], format, "Enhanced_Resume", "Resume")
