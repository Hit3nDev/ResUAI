"""
auth.py — JWT authentication utilities for ResUAI
Handles password hashing, token creation, and token verification.
Does NOT touch ai_engine.py or any existing AI logic.

FIX: passlib 1.7.4 + bcrypt 4.x/5.x incompatibility.
     passlib's internal wrap-bug detection passes a >72-byte string which
     newer bcrypt rejects with ValueError, crashing every signup call.
     Solution: use bcrypt directly — same security, same interface, no passlib needed.
"""

import sqlite3
import os
import uuid
import bcrypt as _bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Config ─────────────────────────────────────────────────────────────────────
# SECRET_KEY must be set via RESUAI_SECRET env var.
# config.py enforces this at startup — no fallback default in production.
SECRET_KEY         = os.environ.get("RESUAI_SECRET", "")
ALGORITHM          = "HS256"
TOKEN_EXPIRE_HOURS = 72

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.normpath(os.path.join(BASE_DIR, "..", "resume_app.db"))

# ── Password hashing (direct bcrypt — avoids passlib/bcrypt4.x incompatibility) ──
def hash_password(plain: str) -> str:
    """Hash a plain-text password. Returns bcrypt hash as a string."""
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a stored bcrypt hash."""
    try:
        return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

# ── JWT ───────────────────────────────────────────────────────────────────────
def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "email": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

# ── DB helpers ────────────────────────────────────────────────────────────────
def _conn():
    return sqlite3.connect(DB_PATH)

def init_auth_tables():
    """Create users + user_resumes tables if they don't exist."""
    con = _conn()
    c   = con.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            TEXT PRIMARY KEY,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at    TEXT NOT NULL
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS user_resumes (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT NOT NULL,
            attempt_id  INTEGER,
            title       TEXT,
            resume_data TEXT,
            created_at  TEXT NOT NULL,
            FOREIGN KEY (user_id)    REFERENCES users(id),
            FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE SET NULL
        )
    """)
    con.commit()
    con.close()

def create_user(email: str, password: str) -> dict:
    con = _conn()
    c   = con.cursor()
    c.execute("SELECT id FROM users WHERE email = ?", (email.lower(),))
    if c.fetchone():
        con.close()
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    user_id = str(uuid.uuid4())
    now     = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
        (user_id, email.lower(), hash_password(password), now),
    )
    con.commit()
    con.close()
    return {"id": user_id, "email": email.lower(), "created_at": now}

def get_user_by_email(email: str) -> Optional[dict]:
    con = _conn()
    c   = con.cursor()
    c.execute("SELECT id, email, password_hash, created_at FROM users WHERE email = ?", (email.lower(),))
    row = c.fetchone()
    con.close()
    if row:
        return {"id": row[0], "email": row[1], "password_hash": row[2], "created_at": row[3]}
    return None

def get_user_by_id(user_id: str) -> Optional[dict]:
    con = _conn()
    c   = con.cursor()
    c.execute("SELECT id, email, created_at FROM users WHERE id = ?", (user_id,))
    row = c.fetchone()
    con.close()
    if row:
        return {"id": row[0], "email": row[1], "created_at": row[2]}
    return None

def save_user_resume(user_id: str, attempt_id: int, title: str, resume_data: str) -> int:
    import json
    con = _conn()
    c   = con.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute(
        "INSERT INTO user_resumes (user_id, attempt_id, title, resume_data, created_at) VALUES (?,?,?,?,?)",
        (user_id, attempt_id, title, resume_data, now),
    )
    rid = c.lastrowid
    con.commit()
    con.close()
    return rid

def get_user_resumes(user_id: str) -> list:
    con = _conn()
    c   = con.cursor()
    c.execute(
        "SELECT id, user_id, attempt_id, title, resume_data, created_at "
        "FROM user_resumes WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    )
    rows = con.fetchall() if False else c.fetchall()
    con.close()
    cols = ["id","user_id","attempt_id","title","resume_data","created_at"]
    return [dict(zip(cols, r)) for r in rows]

# ── FastAPI dependency: require authenticated user ────────────────────────────
_bearer = HTTPBearer(auto_error=False)

def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """FastAPI dependency — raises 401 if no valid token."""
    if not creds or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(creds.credentials)
    user    = get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user

def get_optional_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[dict]:
    """FastAPI dependency — returns None if not authenticated (no error)."""
    if not creds or not creds.credentials:
        return None
    try:
        payload = decode_token(creds.credentials)
        return get_user_by_id(payload["sub"])
    except Exception:
        return None
