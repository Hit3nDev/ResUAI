"""routes/history.py"""
from fastapi import APIRouter, HTTPException
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import get_all_attempts, get_attempt_by_id, delete_attempt, clear_all_attempts, get_stats, format_file_size
from doc_generator import generate_docx, generate_pdf
from fastapi.responses import Response

router = APIRouter()

@router.get("/")
async def list_history():
    return get_all_attempts()

@router.get("/stats")
async def history_stats():
    s = get_stats()
    s["total_file_size_human"] = format_file_size(s.get("total_file_size", 0))
    return s

@router.get("/{attempt_id}")
async def get_attempt(attempt_id: int):
    a = get_attempt_by_id(attempt_id)
    if not a: raise HTTPException(404, "Not found")
    return a

@router.delete("/{attempt_id}")
async def delete_one(attempt_id: int):
    delete_attempt(attempt_id)
    return {"ok": True}

@router.delete("/")
async def delete_all():
    clear_all_attempts()
    return {"ok": True}

@router.get("/{attempt_id}/download/{format}")
async def download_from_history(attempt_id: int, format: str):
    a = get_attempt_by_id(attempt_id)
    if not a: raise HTTPException(404, "Not found")
    text = a["full_output"] or ""
    if format == "docx":
        data = generate_docx(text, "Resume")
        return Response(data, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        headers={"Content-Disposition": f'attachment; filename="session_{attempt_id}.docx"'})
    elif format == "pdf":
        data = generate_pdf(text, "Resume")
        return Response(data, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="session_{attempt_id}.pdf"'})
    return Response(text.encode(), media_type="text/plain",
                    headers={"Content-Disposition": f'attachment; filename="session_{attempt_id}.txt"'})
