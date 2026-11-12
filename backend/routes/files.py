"""routes/files.py — collection routes accept both /files and /files/ (see history.py)."""
import sys, os
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import (
    get_all_files, get_file_by_id, get_file_bytes, delete_file_record, save_file, format_file_size,
)
from downloads import safe_filename
from file_parser import extract_text_from_bytes

router = APIRouter()


@router.get("")
@router.get("/", include_in_schema=False)
async def list_files():
    files = get_all_files()
    for f in files:
        f["size_human"] = format_file_size(f["file_size"])
    return files


@router.delete("/{file_id}")
async def delete_file(file_id: int):
    delete_file_record(file_id)
    return {"ok": True}


@router.get("/{file_id}/download")
async def download_file(file_id: int):
    found = get_file_by_id(file_id)
    if not found:
        raise HTTPException(404, "File not found")
    data = get_file_bytes(found["stored_name"])
    if data is None:
        raise HTTPException(404, "File data not found")
    media = found.get("file_type") or "application/octet-stream"
    fname = safe_filename(found["filename"], "download")
    return Response(content=data, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    purpose: str = Form("upload"),
):
    contents = await file.read()
    return save_file(contents, safe_filename(file.filename, "upload"),
                     file.content_type or "application/octet-stream", purpose=purpose)


@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        text = extract_text_from_bytes(file.filename or "", contents)
    except ValueError as e:
        raise HTTPException(400, str(e))
    save_file(contents, safe_filename(file.filename, "resume"), file.content_type or "", purpose="resume_input")
    return {"text": text, "word_count": len(text.split()), "filename": file.filename}
