"""downloads.py — one place that turns resume text into a DOCX / PDF / TXT HTTP response."""

import re
from fastapi import HTTPException
from fastapi.responses import Response

from doc_generator import generate_docx, generate_pdf, get_download_filename

MEDIA_TYPES = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf":  "application/pdf",
    "txt":  "text/plain; charset=utf-8",
}


def candidate_name_from_metadata(metadata, default: str = "Resume") -> str:
    """attempts.metadata is a JSON string (or already a dict) — pull out the candidate name."""
    import json
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except (ValueError, TypeError):
            metadata = {}
    if isinstance(metadata, dict):
        return str(metadata.get("name") or default)
    return default


def download_response(text: str, fmt: str, candidate_name: str = "Resume", feature: str = "Resume") -> Response:
    fmt = (fmt or "").lower()
    if fmt not in MEDIA_TYPES:
        raise HTTPException(status_code=400, detail="Format must be docx, pdf, or txt")
    text = text or ""
    if fmt == "docx":
        data = generate_docx(text, candidate_name)
    elif fmt == "pdf":
        data = generate_pdf(text, candidate_name)
    else:
        data = text.encode("utf-8")
    fname = get_download_filename(candidate_name, feature, fmt)
    return Response(
        content=data,
        media_type=MEDIA_TYPES[fmt],
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


def safe_filename(name: str, default: str = "file") -> str:
    """Strip path separators / odd characters from a user-supplied filename."""
    name = (name or "").replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^\w.\- ]", "_", name).strip(" .")
    return name or default
