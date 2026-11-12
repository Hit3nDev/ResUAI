"""
FastAPI backend — ResUAI
Auth layer on top of the AI resume tools.
"""

import sys
import os
from contextlib import asynccontextmanager

sys.path.insert(0, os.path.dirname(__file__))

# ── Validate required env vars before anything else starts ───────────────────
from config import validate, ALLOW_ORIGINS, PORT
validate()   # exits with clear error if GROQ_API_KEY or RESUAI_SECRET is missing

# ── FastAPI & stdlib imports ──────────────────────────────────────────────────
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import init_db, get_stats, format_file_size
from auth import init_auth_tables

# ── Routers ──────────────────────────────────────────────────────────────────
from routes.resume  import router as resume_router
from routes.enhance import router as enhance_router
from routes.ats     import router as ats_router
from routes.history import router as history_router
from routes.files   import router as files_router
from routes.auth    import router as auth_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()            # attempts + files tables
    init_auth_tables()   # users + user_resumes tables
    yield


docs_off = os.environ.get("DOCS_DISABLED", "").strip().lower() in ("1", "true", "yes")

app = FastAPI(
    title="ResUAI API",
    version="3.0.0",
    description="ResUAI — AI-powered resume builder.",
    lifespan=lifespan,
    docs_url=None if docs_off else "/docs",
    redoc_url=None if docs_off else "/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# "*" with credentials is rejected by browsers, so credentials are only enabled for explicit origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials="*" not in ALLOW_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Validation errors → a single readable string in `detail` ─────────────────
# (the frontend does `new Error(err.detail)`; FastAPI's default is a list of objects)
@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    msgs = []
    for e in exc.errors():
        msg = str(e.get("msg", "Invalid input"))
        if msg.startswith("Value error, "):          # our own validators already read well
            msgs.append(msg[len("Value error, "):])
            continue
        loc = [str(p) for p in e.get("loc", ()) if p not in ("body", "query", "path", "form")]
        msgs.append(f"{'.'.join(loc)}: {msg}" if loc else msg)
    return JSONResponse(status_code=422, content={"detail": " ".join(m if m.endswith(".") else m + "." for m in msgs) or "Invalid request"})


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
