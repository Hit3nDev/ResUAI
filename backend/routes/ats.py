"""routes/ats.py — wraps check_ats() from ai_engine.py"""

import json
import sys, os
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ai_engine import check_ats
from database import save_attempt, save_file, save_output_file
from downloads import safe_filename
from file_parser import extract_text_from_bytes
from config import GROQ_API_KEY   # loaded from env, never hardcoded

router = APIRouter()


class ATSRequest(BaseModel):
    resume_text: str
    job_description: str


def _score(v) -> int:
    try:
        return max(0, min(100, int(round(float(v)))))
    except (TypeError, ValueError):
        return 0


def _str_list(v) -> list:
    return [str(x) for x in v] if isinstance(v, list) else []


def normalize_ats(result) -> dict:
    """Make the AI's JSON safe for the frontend: right types, scores clamped to 0-100."""
    if not isinstance(result, dict):
        raise ValueError("AI returned an unexpected ATS response")
    out = dict(result)
    for k in ("overall_score", "keyword_score", "format_score", "relevance_score"):
        out[k] = _score(result.get(k))
    for k in ("matched_keywords", "missing_keywords", "strengths", "improvements"):
        out[k] = _str_list(result.get(k))
    sec = result.get("section_scores")
    out["section_scores"] = {str(k): _score(v) for k, v in sec.items()} if isinstance(sec, dict) else {}
    out["verdict"] = str(result.get("verdict") or "")
    return out


def format_ats_report(result: dict) -> str:
    nl = "\n"
    return f"""ATS COMPATIBILITY REPORT
========================
Overall Score:   {result.get('overall_score', 0)}/100
Keyword Score:   {result.get('keyword_score', 0)}/100
Format Score:    {result.get('format_score', 0)}/100
Relevance Score: {result.get('relevance_score', 0)}/100
Verdict:         {result.get('verdict', '')}

MATCHED KEYWORDS ({len(result.get('matched_keywords', []))})
{nl.join('  - ' + k for k in result.get('matched_keywords', []))}

MISSING KEYWORDS ({len(result.get('missing_keywords', []))})
{nl.join('  - ' + k for k in result.get('missing_keywords', []))}

STRENGTHS
{nl.join(f'  {i+1}. {s}' for i, s in enumerate(result.get('strengths', [])))}

IMPROVEMENTS
{nl.join(f'  {i+1}. {s}' for i, s in enumerate(result.get('improvements', [])))}
"""


def _run_and_store(resume_text: str, jd_text: str, input_summary: str) -> dict:
    try:
        result = normalize_ats(check_ats(GROQ_API_KEY, resume_text, jd_text))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ATS analysis error: {str(e)}")

    report = format_ats_report(result)
    attempt_id = save_attempt(
        feature="ATS Checker",
        input_summary=input_summary,
        output_preview=f"Score: {result['overall_score']} | {result['verdict']}",
        full_output=report,
        ats_score=result["overall_score"],
        metadata=result,
    )
    save_output_file(report, "ATS_Report.txt", attempt_id=attempt_id)
    result["attempt_id"] = attempt_id
    return result


@router.post("/analyze")
async def analyze_ats(req: ATSRequest):
    if not req.resume_text.strip() or not req.job_description.strip():
        raise HTTPException(status_code=422, detail="Both resume text and job description are required.")
    return _run_and_store(
        req.resume_text, req.job_description,
        f"Resume: {len(req.resume_text.split())} words | JD: {len(req.job_description.split())} words",
    )


@router.post("/upload")
async def analyze_from_files(
    resume: UploadFile = File(...),
    job_description_file: Optional[UploadFile] = File(None),
    job_description_text: str = Form(""),
):
    r_bytes = await resume.read()
    try:
        resume_text = extract_text_from_bytes(resume.filename or "", r_bytes)
    except ValueError as e:
        raise HTTPException(400, f"Resume parse error: {str(e)}")
    save_file(r_bytes, safe_filename(resume.filename, "resume"), resume.content_type or "", purpose="ats_resume")

    jd_text = job_description_text
    if job_description_file is not None and job_description_file.filename:
        jd_bytes = await job_description_file.read()
        try:
            jd_text = extract_text_from_bytes(job_description_file.filename, jd_bytes)
        except ValueError as e:
            raise HTTPException(400, f"JD parse error: {str(e)}")
        save_file(jd_bytes, safe_filename(job_description_file.filename, "jd"),
                  job_description_file.content_type or "", purpose="ats_jd")

    if not jd_text.strip():
        raise HTTPException(400, "Job description is required")

    return _run_and_store(resume_text, jd_text, f"File: {resume.filename}")
