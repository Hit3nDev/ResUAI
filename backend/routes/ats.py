"""routes/ats.py — wraps check_ats() from ai_engine.py"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai_engine import check_ats        # ← UNTOUCHED
from database import save_attempt, save_file, save_output_file
from file_parser import extract_text_from_upload  # ← UNTOUCHED
from config import GROQ_API_KEY   # ← loaded from env, never hardcoded

router = APIRouter()


class ATSRequest(BaseModel):
    resume_text: str
    job_description: str


@router.post("/analyze")
async def analyze_ats(req: ATSRequest):
    try:
        result = check_ats(GROQ_API_KEY, req.resume_text, req.job_description)  # ← UNTOUCHED
    except Exception as e:
        raise HTTPException(500, f"ATS analysis error: {str(e)}")

    report = f"""ATS COMPATIBILITY REPORT
========================
Overall Score:   {result.get('overall_score',0)}/100
Keyword Score:   {result.get('keyword_score',0)}/100
Format Score:    {result.get('format_score',0)}/100
Relevance Score: {result.get('relevance_score',0)}/100
Verdict:         {result.get('verdict','')}

MATCHED KEYWORDS ({len(result.get('matched_keywords',[]))})
{chr(10).join('  - '+k for k in result.get('matched_keywords',[]))}

MISSING KEYWORDS ({len(result.get('missing_keywords',[]))})
{chr(10).join('  - '+k for k in result.get('missing_keywords',[]))}

STRENGTHS
{chr(10).join(f'  {i+1}. {s}' for i,s in enumerate(result.get('strengths',[])))}

IMPROVEMENTS
{chr(10).join(f'  {i+1}. {s}' for i,s in enumerate(result.get('improvements',[])))}
"""
    attempt_id = save_attempt(
        feature="ATS Checker",
        input_summary=f"Resume: {len(req.resume_text.split())} words | JD: {len(req.job_description.split())} words",
        output_preview=f"Score: {result.get('overall_score')} | {result.get('verdict')}",
        full_output=str(result), ats_score=result.get("overall_score"), metadata=result
    )
    save_output_file(report, "ATS_Report.txt", attempt_id=attempt_id)
    result["attempt_id"] = attempt_id
    return result


@router.post("/upload")
async def analyze_from_files(
    resume: UploadFile = File(...),
    job_description_file: Optional[UploadFile] = File(None),
    job_description_text: str = Form(""),
):
    try:
        r_bytes = await resume.read()
        class _FU:
            name = resume.filename
            def read(self_): return r_bytes
        resume_text = extract_text_from_upload(_FU())
        save_file(r_bytes, resume.filename, resume.content_type or "", purpose="ats_resume")
    except Exception as e:
        raise HTTPException(400, f"Resume parse error: {str(e)}")

    jd_text = job_description_text
    if job_description_file:
        try:
            jd_bytes = await job_description_file.read()
            class _FU2:
                name = job_description_file.filename
                def read(self_): return jd_bytes
            jd_text = extract_text_from_upload(_FU2())
            save_file(jd_bytes, job_description_file.filename, job_description_file.content_type or "", purpose="ats_jd")
        except Exception as e:
            raise HTTPException(400, f"JD parse error: {str(e)}")

    if not jd_text: raise HTTPException(400, "Job description is required")

    try:
        result = check_ats(GROQ_API_KEY, resume_text, jd_text)
    except Exception as e:
        raise HTTPException(500, f"ATS error: {str(e)}")

    attempt_id = save_attempt(
        feature="ATS Checker",
        input_summary=f"File: {resume.filename}",
        output_preview=f"Score: {result.get('overall_score')} | {result.get('verdict')}",
        full_output=str(result), ats_score=result.get("overall_score"), metadata=result
    )
    result["attempt_id"] = attempt_id
    return result
