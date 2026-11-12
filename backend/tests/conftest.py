"""
Test fixtures. Env vars are set BEFORE the app is imported so the suite never touches the
real resume_app.db / uploads folder / API key.
"""
import io
import os
import sys
import tempfile

_TMP = tempfile.mkdtemp(prefix="resuai_tests_")
os.environ["GROQ_API_KEY"] = "gsk_test_fake_key"
os.environ["RESUAI_SECRET"] = "test-secret-" + "x" * 40
os.environ["RESUAI_DB_PATH"] = os.path.join(_TMP, "test.db")
os.environ["RESUAI_UPLOAD_DIR"] = os.path.join(_TMP, "uploads")
os.environ["DOCS_DISABLED"] = "0"

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)

import pytest
from fastapi.testclient import TestClient

import main
from routes import resume as r_resume, enhance as r_enhance, ats as r_ats

SAMPLE_RESUME = """JANE DOE
jane.doe@example.com | +1 555 010 0199 | Austin, TX

SUMMARY
Backend engineer with 5 years of experience building reliable APIs.

EXPERIENCE
Acme Corp   Jan 2020 – Present
Senior Engineer   Austin, TX
• Cut p95 latency by 40% across 12 services
• Led a team of 5 engineers

EDUCATION
University of Texas   2015 – 2019
B.S. Computer Science

SKILLS
Languages: Python, Go, SQL
Tools: Docker, AWS
"""

SAMPLE_ATS = {
    "overall_score": 82, "keyword_score": 78, "format_score": 90, "relevance_score": 80,
    "matched_keywords": ["Python", "AWS"], "missing_keywords": ["Kubernetes"],
    "strengths": ["Clear metrics"], "improvements": ["Add Kubernetes"],
    "section_scores": {"summary": 80, "experience": 85, "education": 70, "skills": 75},
    "verdict": "Good",
}


@pytest.fixture(scope="session")
def client():
    with TestClient(main.app) as c:     # `with` runs the lifespan (creates tables)
        yield c


@pytest.fixture(autouse=True)
def clean_db(client):
    """Fresh attempts/files/users for every test."""
    import sqlite3
    from database import DB_PATH, UPLOAD_DIR
    con = sqlite3.connect(DB_PATH)
    for t in ("user_resumes", "users", "files", "attempts"):
        con.execute(f"DELETE FROM {t}")
    con.commit()
    con.close()
    for f in os.listdir(UPLOAD_DIR):
        os.remove(os.path.join(UPLOAD_DIR, f))
    yield


@pytest.fixture
def ai(monkeypatch):
    """Mock every AI call; returns a dict of call logs so tests can assert on arguments."""
    calls = {"create": [], "enhance": [], "ats": [], "cover": []}

    def fake_create(key, data):
        calls["create"].append(data)
        return SAMPLE_RESUME

    def fake_enhance(key, text, job_title="", job_description="", focus=None):
        calls["enhance"].append({"text": text, "job_title": job_title, "jd": job_description, "focus": focus})
        return "ENHANCED\n" + text

    def fake_ats(key, resume, jd):
        calls["ats"].append((resume, jd))
        return dict(SAMPLE_ATS)

    def fake_cover(key, resume, jd, company="", tone="Professional"):
        calls["cover"].append({"jd": jd, "company": company, "tone": tone})
        return "Dear Hiring Manager,\nHello.\nSincerely, Jane"

    monkeypatch.setattr(r_resume, "create_resume", fake_create)
    monkeypatch.setattr(r_resume, "generate_cover_letter", fake_cover)
    monkeypatch.setattr(r_enhance, "enhance_resume", fake_enhance)
    monkeypatch.setattr(r_enhance, "generate_cover_letter", fake_cover)
    monkeypatch.setattr(r_ats, "check_ats", fake_ats)
    return calls


@pytest.fixture
def auth_headers(client):
    r = client.post("/api/auth/signup", json={
        "email": "user@example.com", "password": "password123", "confirm_password": "password123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def make_pdf(text_lines):
    from reportlab.lib.pagesizes import LETTER
    from reportlab.pdfgen import canvas
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=LETTER)
    y = 720
    for ln in text_lines:
        c.drawString(72, y, ln)
        y -= 16
    c.save()
    return buf.getvalue()


def make_docx(paragraphs):
    from docx import Document
    d = Document()
    for p in paragraphs:
        d.add_paragraph(p)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


CREATE_PAYLOAD = {
    "personal": {"name": "Jane Doe", "email": "jane@example.com", "phone": "+1 555", "location": "Austin"},
    "target_role": "Backend Engineer",
    "experiences": [{"company": "Acme", "title": "Engineer", "duration": "2020-now", "bullets": ["Did things"]}],
    "education": [{"degree": "BS CS", "school": "UT", "year": "2019"}],
    "skills": {"technical": ["Python"], "soft": ["Teamwork"]},
}
