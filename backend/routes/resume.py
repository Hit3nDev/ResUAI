"""
routes/resume.py — wraps create_resume() and generate_cover_letter() from ai_engine.py
"""

import logging
import sys, os
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai_engine import create_resume, generate_cover_letter
from database import save_attempt, save_output_file, get_attempt_by_id
from downloads import download_response, candidate_name_from_metadata, safe_filename
from config import GROQ_API_KEY   # loaded from env, never hardcoded

router = APIRouter()
log = logging.getLogger("resuai")


class PersonalInfo(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    location: Optional[str] = ""
    linkedin: Optional[str] = ""
    website: Optional[str] = ""

class Experience(BaseModel):
    company: str
    title: str
    duration: Optional[str] = ""
    location: Optional[str] = ""
    bullets: Optional[List[str]] = []

class Education(BaseModel):
    degree: str
    school: str
    year: Optional[str] = ""
    gpa: Optional[str] = ""

class Skills(BaseModel):
    technical: Optional[List[str]] = []
    soft: Optional[List[str]] = []

class CreateResumeRequest(BaseModel):
    personal: PersonalInfo
    target_role: str
    experience_level: str = "Fresher / Entry Level"
    summary_hint: Optional[str] = ""
    experiences: Optional[List[Experience]] = []
    education: Optional[List[Education]] = []
    skills: Optional[Skills] = None
    certifications: Optional[List[str]] = []
    projects: Optional[List[str]] = []
    languages: Optional[List[str]] = []
    achievements: Optional[List[str]] = []
    generate_cover_letter: Optional[bool] = False
    company_name: Optional[str] = ""
    cover_tone: Optional[str] = "Professional"
    job_description: Optional[str] = ""

class CreateResumeResponse(BaseModel):
    resume_text: str
    cover_letter: Optional[str] = None
    attempt_id: int
    word_count: int
    char_count: int


@router.post("/create", response_model=CreateResumeResponse)
async def create(req: CreateResumeRequest):
    """Create a resume from scratch."""
    if not req.personal.name.strip() or not req.target_role.strip():
        raise HTTPException(status_code=422, detail="Name and target role are required.")

    user_data = {
        "personal": req.personal.model_dump(),
        "target_role": req.target_role,
        "experience_level": req.experience_level,
        "summary_hint": req.summary_hint,
        "experiences": [e.model_dump() for e in (req.experiences or [])],
        "education":   [e.model_dump() for e in (req.education or [])],
        "skills": req.skills.model_dump() if req.skills else {"technical": [], "soft": []},
        "certifications": req.certifications or [],
        "projects":       req.projects or [],
        "languages":      req.languages or [],
        "achievements":   req.achievements or [],
    }

    try:
        resume_text = create_resume(GROQ_API_KEY, user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    base = safe_filename(req.personal.name.replace(" ", "_"), "Resume")
    attempt_id = save_attempt(
        feature="Create Resume",
        input_summary=f"{req.personal.name} | {req.target_role} | {req.experience_level}",
        output_preview=resume_text[:300],
        full_output=resume_text,
        metadata={"name": req.personal.name, "role": req.target_role},
    )
    save_output_file(resume_text, f"{base}_Resume.txt", attempt_id=attempt_id)

    cover_letter = None
    if req.generate_cover_letter:
        jd = req.job_description or f"Role: {req.target_role}"
        try:
            cover_letter = generate_cover_letter(
                GROQ_API_KEY, resume_text, jd,
                req.company_name or "", req.cover_tone or "Professional",
            )
            save_output_file(cover_letter, f"{base}_CoverLetter.txt", attempt_id=attempt_id)
        except Exception:
            log.exception("Cover letter generation failed (non-fatal)")
            cover_letter = None

    return CreateResumeResponse(
        resume_text=resume_text,
        cover_letter=cover_letter,
        attempt_id=attempt_id,
        word_count=len(resume_text.split()),
        char_count=len(resume_text),
    )


@router.get("/download/{attempt_id}/{format}")
async def download_resume(attempt_id: int, format: str):
    """Download a previously generated resume as DOCX, PDF or TXT."""
    attempt = get_attempt_by_id(attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Resume not found")
    name = candidate_name_from_metadata(attempt.get("metadata"), "Resume")
    return download_response(attempt["full_output"], format, name, "Resume")
