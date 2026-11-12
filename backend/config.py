"""
config.py — ResUAI backend configuration
=========================================
All environment variables are loaded here exactly once.
Import from this module — never use os.getenv() scattered across route files.

REQUIRED env vars (app refuses to start without them):
  GROQ_API_KEY   — Groq API key (starts with gsk_)
  RESUAI_SECRET  — JWT signing secret (random string, min 32 chars)

OPTIONAL env vars:
  RESUAI_DB_PATH    — SQLite file location (default ../resume_app.db)
  RESUAI_UPLOAD_DIR — upload folder (default ../uploads)
  PORT           — HTTP port (default 10000 for Render.com)
  ALLOW_ORIGINS  — Comma-separated CORS origins (default *)
"""

import os
import sys

# Load backend/.env (if present) BEFORE reading any variable. Real environment
# variables always win over the file (override=False).
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"), override=False)
except ImportError:  # python-dotenv is optional at runtime
    pass


# ── Load values ────────────────────────────────────────────────────────────────

GROQ_API_KEY  = os.environ.get("GROQ_API_KEY", "").strip()
RESUAI_SECRET = os.environ.get("RESUAI_SECRET", "").strip()
PORT          = int(os.environ.get("PORT") or 10000)
ALLOW_ORIGINS = [o.strip() for o in os.environ.get("ALLOW_ORIGINS", "*").split(",") if o.strip()] or ["*"]


# ── Startup validation — fail fast, clear error message ───────────────────────

def validate():
    """
    Called once on application startup.
    Exits with a clear message if any required env var is missing,
    instead of crashing later with a cryptic 500 error.
    """
    missing = []

    if not GROQ_API_KEY:
        missing.append("GROQ_API_KEY  (get a free key at console.groq.com)")

    if not RESUAI_SECRET:
        missing.append("RESUAI_SECRET  (generate with: python -c \"import secrets; print(secrets.token_hex(32))\")")

    if len(RESUAI_SECRET) < 32 and RESUAI_SECRET:
        print(
            "WARNING: RESUAI_SECRET is shorter than 32 characters. "
            "Use a longer secret in production.",
            file=sys.stderr,
        )

    if missing:
        print("\n" + "=" * 60, file=sys.stderr)
        print("ResUAI startup error — missing required environment variables:", file=sys.stderr)
        for m in missing:
            print(f"  • {m}", file=sys.stderr)
        print("\nCreate a .env file (see .env.example) or set these in your deployment.", file=sys.stderr)
        print("=" * 60 + "\n", file=sys.stderr)
        sys.exit(1)
