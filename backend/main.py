"""
FastAPI backend — ResUAI
Wraps existing AI modules without modifying them.
Auth layer added on top — ai_engine.py is never touched.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

# ── Validate required env vars before anything else starts ───────────────────
from config import validate, ALLOW_ORIGINS, PORT
validate()   # exits with clear error if GROQ_API_KEY or RESUAI_SECRET is missing

# ── FastAPI & stdlib imports ──────────────────────────────────────────────────
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse

# ── AI modules AS-IS (zero modification) ────────────────────────────────────
from ai_engine import create_resume, enhance_resume, check_ats, generate_cover_letter
from database  import (
    init_db, save_attempt, save_file, save_output_file,
    get_all_attempts, get_attempt_by_id, delete_attempt,
    clear_all_attempts, get_stats, get_all_files,
    get_file_bytes, delete_file_record, format_file_size, get_files_for_attempt,
)
from file_parser   import extract_text_from_upload
from doc_generator import generate_docx, generate_pdf, get_download_filename

# ── Routers ──────────────────────────────────────────────────────────────────
from routes.resume  import router as resume_router
from routes.enhance import router as enhance_router
from routes.ats     import router as ats_router
from routes.history import router as history_router
from routes.files   import router as files_router
from routes.auth    import router as auth_router
from auth import init_auth_tables

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ResUAI API",
    version="3.0.0",
    description="ResUAI — AI-powered resume builder.",
    # Hide docs in production by setting DOCS_DISABLED=1
    docs_url=None if os.environ.get("DOCS_DISABLED") else "/docs",
    redoc_url=None if os.environ.get("DOCS_DISABLED") else "/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Set ALLOW_ORIGINS in .env for production, e.g.:
#   ALLOW_ORIGINS=https://yourapp.vercel.app,https://www.yourapp.com
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_db()            # existing resume/files tables
    init_auth_tables()   # users + user_resumes tables

# ── Register routers ──────────────────────────────────────────────────────────
app.include_router(auth_router,    prefix="/api/auth",    tags=["Auth"])
app.include_router(resume_router,  prefix="/api/resume",  tags=["Resume"])
app.include_router(enhance_router, prefix="/api/enhance", tags=["Enhance"])
app.include_router(ats_router,     prefix="/api/ats",     tags=["ATS"])
app.include_router(history_router, prefix="/api/history", tags=["History"])
app.include_router(files_router,   prefix="/api/files",   tags=["Files"])

# ── Health / Stats ────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "3.0.0", "app": "ResUAI"}

@app.get("/api/stats")
async def stats():
    s = get_stats()
    s["total_file_size_human"] = format_file_size(s.get("total_file_size", 0))
    return s

# ── Entrypoint (used by: python main.py or Render start command) ──────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
