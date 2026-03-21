"""routes/files.py"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from database import get_all_files, get_file_bytes, delete_file_record, save_file, format_file_size
from file_parser import extract_text_from_upload

router = APIRouter()

@router.get("/")
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
    from database import get_all_files
    all_f = get_all_files()
    found = next((f for f in all_f if f["id"] == file_id), None)
    if not found: raise HTTPException(404, "File not found")
    data = get_file_bytes(found["stored_name"])
    if not data: raise HTTPException(404, "File data not found")
    return Response(content=data, headers={"Content-Disposition": f'attachment; filename="{found["filename"]}"'})

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    purpose: str = Form("upload"),
):
    contents = await file.read()
    record = save_file(contents, file.filename, file.content_type or "application/octet-stream", purpose=purpose)
    return record

@router.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    contents = await file.read()
    class _FU:
        name = file.filename
        def read(self_): return contents
    try:
        text = extract_text_from_upload(_FU())
        save_file(contents, file.filename, file.content_type or "", purpose="resume_input")
        return {"text": text, "word_count": len(text.split()), "filename": file.filename}
    except Exception as e:
        raise HTTPException(400, str(e))
