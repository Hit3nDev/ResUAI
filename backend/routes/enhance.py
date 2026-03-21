"""routes/enhance.py — wraps enhance_resume() from ai_engine.py"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai_engine import enhance_resume, generate_cover_letter   # ← UNTOUCHED
from database import save_attempt, save_file, save_output_file
from file_parser import extract_text_from_upload              # ← UNTOUCHED
from doc_generator import generate_docx, generate_pdf, get_download_filename
from config import GROQ_API_KEY   # ← loaded from env, never hardcoded

router = APIRouter()


class EnhanceTextRequest(BaseModel):
    resume_text: str
    job_title: Optional[str] = ""
    job_description: Optional[str] = ""
    enhance_focus: Optional[List[str]] = []
    generate_cover_letter: Optional[bool] = False
    company_name: Optional[str] = ""
    cover_tone: Optional[str] = "Professional"


@router.post("/text")
async def enhance_from_text(req: EnhanceTextRequest):
    try:
        enhanced = enhance_resume(GROQ_API_KEY, req.resume_text, req.job_title, req.job_description)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    attempt_id = save_attempt(
        feature="Enhance Resume",
        input_summary=f"Target: {req.job_title or 'General'} | {len(req.resume_text.split())} words",
        output_preview=enhanced[:300], full_output=enhanced,
        metadata={"job_title": req.job_title, "focus": req.enhance_focus}
    )
    save_output_file(enhanced, f"Enhanced_Resume.txt", attempt_id=attempt_id)

    cover_letter = None
    if req.generate_cover_letter and req.job_description:
        try:
            cover_letter = generate_cover_letter(GROQ_API_KEY, enhanced, req.job_description, req.company_name or "", req.cover_tone or "Professional")
        except: pass

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
):
    try:
        contents = await file.read()
        class _FakeUpload:
            name = file.filename
            def read(self_): return contents
        text = extract_text_from_upload(_FakeUpload())
        save_file(contents, file.filename, file.content_type or "application/octet-stream", purpose="resume_input")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File parse error: {str(e)}")

    try:
        enhanced = enhance_resume(GROQ_API_KEY, text, job_title, job_description)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    attempt_id = save_attempt(
        feature="Enhance Resume",
        input_summary=f"File: {file.filename} | {len(text.split())} words",
        output_preview=enhanced[:300], full_output=enhanced,
        metadata={"filename": file.filename, "job_title": job_title}
    )
    save_output_file(enhanced, "Enhanced_Resume.txt", attempt_id=attempt_id)

    return {"enhanced_text": enhanced, "original_text": text, "attempt_id": attempt_id,
            "original_word_count": len(text.split()), "enhanced_word_count": len(enhanced.split())}


@router.get("/download/{attempt_id}/{format}")
async def download_enhanced(attempt_id: int, format: str):
    from database import get_attempt_by_id
    attempt = get_attempt_by_id(attempt_id)
    if not attempt: raise HTTPException(404, "Not found")
    text = attempt["full_output"]
    if format == "docx":
        data = generate_docx(text, "Enhanced_Resume")
        return Response(data, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        headers={"Content-Disposition": 'attachment; filename="Enhanced_Resume.docx"'})
    elif format == "pdf":
        data = generate_pdf(text, "Enhanced_Resume")
        return Response(data, media_type="application/pdf",
                        headers={"Content-Disposition": 'attachment; filename="Enhanced_Resume.pdf"'})
    return Response(text.encode(), media_type="text/plain")
