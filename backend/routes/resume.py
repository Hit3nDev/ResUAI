"""
routes/resume.py — wraps create_resume() and generate_cover_letter() from ai_engine.py
AI functions are NEVER modified, only called.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai_engine import create_resume, generate_cover_letter
from database import save_attempt, save_output_file
from doc_generator import generate_docx, generate_pdf, get_download_filename
from config import GROQ_API_KEY   # ← loaded from env, never hardcoded

router = APIRouter()


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
    """Create a resume from scratch. Calls create_resume() from ai_engine.py — unchanged."""
    user_data = {
        "personal": req.personal.dict(),
        "target_role": req.target_role,
        "experience_level": req.experience_level,
        "summary_hint": req.summary_hint,
        "experiences": [e.dict() for e in (req.experiences or [])],
        "education":   [e.dict() for e in (req.education or [])],
        "skills": req.skills.dict() if req.skills else {"technical": [], "soft": []},
        "certifications": req.certifications or [],
        "projects":       req.projects or [],
        "languages":      req.languages or [],
        "achievements":   req.achievements or [],
    }

    try:
        # ← AI FUNCTION — UNTOUCHED
        resume_text = create_resume(GROQ_API_KEY, user_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    attempt_id = save_attempt(
        feature="Create Resume",
        input_summary=f"{req.personal.name} | {req.target_role} | {req.experience_level}",
        output_preview=resume_text[:300],
        full_output=resume_text,
        metadata={"name": req.personal.name, "role": req.target_role}
    )
    save_output_file(resume_text, f"{req.personal.name.replace(' ','_')}_Resume.txt", attempt_id=attempt_id)

    cover_letter = None
    if req.generate_cover_letter and req.job_description:
        try:
            # ← AI FUNCTION — UNTOUCHED
            cover_letter = generate_cover_letter(
                GROQ_API_KEY, resume_text,
                req.job_description, req.company_name or "", req.cover_tone or "Professional"
            )
            save_output_file(cover_letter, f"{req.personal.name.replace(' ','_')}_CoverLetter.txt", attempt_id=attempt_id)
        except Exception as e:
            cover_letter = None  # Non-fatal

    return CreateResumeResponse(
        resume_text=resume_text,
        cover_letter=cover_letter,
        attempt_id=attempt_id,
        word_count=len(resume_text.split()),
        char_count=len(resume_text),
    )


@router.get("/download/{attempt_id}/{format}")
async def download_resume(attempt_id: int, format: str):
    """Download a previously generated resume as DOCX or PDF."""
    from database import get_attempt_by_id
    attempt = get_attempt_by_id(attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="Resume not found")

    text = attempt["full_output"]
    name = attempt.get("metadata", {})
    if isinstance(name, str):
        import json
        try: name = json.loads(name)
        except: name = {}
    cand_name = name.get("name", "Resume") if isinstance(name, dict) else "Resume"

    if format == "docx":
        data = generate_docx(text, cand_name)
        fname = get_download_filename(cand_name, "Resume", "docx")
        return Response(
            content=data,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'}
        )
    elif format == "pdf":
        data = generate_pdf(text, cand_name)
        fname = get_download_filename(cand_name, "Resume", "pdf")
        return Response(content=data, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{fname}"'})
    elif format == "txt":
        return Response(content=text.encode(), media_type="text/plain",
                        headers={"Content-Disposition": f'attachment; filename="{cand_name}_Resume.txt"'})
    else:
        raise HTTPException(status_code=400, detail="Format must be docx, pdf, or txt")
