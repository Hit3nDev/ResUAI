"""routes/history.py

Every collection route is registered with AND without a trailing slash, so a proxy that
strips the slash (Next.js dev rewrites) never triggers a 307 redirect to an absolute URL.
"""
import sys, os
from fastapi import APIRouter, HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import (
    get_all_attempts, get_attempt_by_id, delete_attempt,
    clear_all_attempts, get_stats, format_file_size,
)
from downloads import download_response, candidate_name_from_metadata

router = APIRouter()


@router.get("")
@router.get("/", include_in_schema=False)
async def list_history():
    return get_all_attempts()


@router.get("/stats")
async def history_stats():
    s = get_stats()
    s["total_file_size_human"] = format_file_size(s.get("total_file_size", 0))
    return s


@router.delete("")
@router.delete("/", include_in_schema=False)
async def delete_all():
    clear_all_attempts()
    return {"ok": True}


@router.get("/{attempt_id}")
async def get_attempt(attempt_id: int):
    a = get_attempt_by_id(attempt_id)
    if not a:
        raise HTTPException(404, "Not found")
    return a


@router.delete("/{attempt_id}")
async def delete_one(attempt_id: int):
    delete_attempt(attempt_id)
    return {"ok": True}


@router.get("/{attempt_id}/download/{format}")
async def download_from_history(attempt_id: int, format: str):
    a = get_attempt_by_id(attempt_id)
    if not a:
        raise HTTPException(404, "Not found")
    name = candidate_name_from_metadata(a.get("metadata"), "Session")
    feature = f"{(a.get('feature') or 'Session').replace(' ', '_')}_{attempt_id}"
    return download_response(a["full_output"] or "", format, name, feature)
