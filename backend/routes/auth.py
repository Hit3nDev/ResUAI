"""
routes/auth.py — Authentication endpoints for ResUAI.
FIXED: explicit step-by-step login checks, no combined short-circuit.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
import re, sys, os
from typing import Optional
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from auth import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_user_resumes,
    save_user_resume,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter()

# Pragmatic email check: local@domain.tld — allows subdomains, plus-addressing, hyphens, etc.
_EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s.]+(?:\.[^@\s.]+)*\.[A-Za-z]{2,}$')


# ── Pydantic models ───────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: str
    password: str
    confirm_password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.lower().strip()
        if len(v) > 254 or not _EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if len(v.encode("utf-8")) > 72:   # bcrypt hard limit
            raise ValueError("Password must be at most 72 bytes.")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match.")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class SaveResumeRequest(BaseModel):
    attempt_id: Optional[int] = None
    title: str
    resume_text: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/signup")
async def signup(req: SignupRequest):
    """Create a new user account. Returns JWT on success."""
    user  = create_user(req.email, req.password)
    token = create_access_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {"id": user["id"], "email": user["email"]},
    }


@router.post("/login")
async def login(req: LoginRequest):
    """
    Authenticate user. Returns JWT on success.

    Fixed flow — explicit step-by-step checks:
      1. Normalise email and look up user in DB.
      2. Return 401 if user not found.
      3. Verify password against stored hash.
      4. Return 401 if password is wrong.
      5. Generate and return token.
    """
    email = req.email.lower().strip()

    # Step 1: look up user
    user = get_user_by_email(email)

    # Step 2: user must exist
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    # Step 3 & 4: verify password (separate try/except for clarity)
    try:
        password_ok = verify_password(req.password, user["password_hash"])
    except Exception as exc:
        # Should never happen after the bcrypt fix, but guard anyway
        raise HTTPException(status_code=500, detail=f"Password verification error: {exc}")

    if not password_ok:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    # Step 5: create and return token
    token = create_access_token(user["id"], user["email"])
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user": {"id": user["id"], "email": user["email"]},
    }


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return {
        "id":         current_user["id"],
        "email":      current_user["email"],
        "created_at": current_user["created_at"],
    }


@router.post("/resumes/save")
async def save_resume(
    req: SaveResumeRequest,
    current_user: dict = Depends(get_current_user),
):
    """Save a generated resume to the user's account."""
    rid = save_user_resume(
        user_id     = current_user["id"],
        attempt_id  = req.attempt_id,
        title       = req.title,
        resume_data = req.resume_text,
    )
    return {"saved": True, "resume_id": rid}


@router.get("/resumes")
async def list_resumes(current_user: dict = Depends(get_current_user)):
    """Return all resumes saved by the authenticated user."""
    return get_user_resumes(current_user["id"])
