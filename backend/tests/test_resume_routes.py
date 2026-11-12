import io

import pdfplumber
from docx import Document

from conftest import CREATE_PAYLOAD, SAMPLE_RESUME


def create(client, **over):
    return client.post("/api/resume/create", json={**CREATE_PAYLOAD, **over})


def test_create_resume_ok_shape(client, ai):
    r = create(client)
    assert r.status_code == 200
    b = r.json()
    assert set(b) == {"resume_text", "cover_letter", "attempt_id", "word_count", "char_count"}
    assert b["resume_text"] == SAMPLE_RESUME and b["cover_letter"] is None
    assert b["word_count"] == len(SAMPLE_RESUME.split()) and b["char_count"] == len(SAMPLE_RESUME)
    # the AI got the full structured payload
    sent = ai["create"][0]
    assert sent["personal"]["name"] == "Jane Doe" and sent["skills"]["technical"] == ["Python"]


def test_create_resume_persists_history_and_output_file(client, ai):
    aid = create(client).json()["attempt_id"]
    h = client.get(f"/api/history/{aid}").json()
    assert h["feature"] == "Create Resume" and "Jane Doe" in h["input_summary"]
    files = client.get("/api/files").json()
    assert any(f["filename"] == "Jane_Doe_Resume.txt" and f["attempt_id"] == aid for f in files)


def test_create_resume_with_cover_letter(client, ai):
    r = create(client, generate_cover_letter=True, company_name="Initech", cover_tone="Friendly",
               job_description="Build APIs")
    assert r.status_code == 200 and r.json()["cover_letter"].startswith("Dear Hiring Manager")
    assert ai["cover"][0] == {"jd": "Build APIs", "company": "Initech", "tone": "Friendly"}
    names = [f["filename"] for f in client.get("/api/files").json()]
    assert "Jane_Doe_CoverLetter.txt" in names


def test_create_resume_cover_letter_without_jd_still_generated(client, ai):
    r = create(client, generate_cover_letter=True)
    assert r.json()["cover_letter"] and ai["cover"][0]["jd"] == "Role: Backend Engineer"


def test_create_resume_cover_letter_failure_is_nonfatal(client, ai, monkeypatch):
    from routes import resume as rr
    def boom(*a, **k): raise RuntimeError("groq down")
    monkeypatch.setattr(rr, "generate_cover_letter", boom)
    r = create(client, generate_cover_letter=True, job_description="x")
    assert r.status_code == 200 and r.json()["cover_letter"] is None


def test_create_resume_ai_failure_500(client, ai, monkeypatch):
    from routes import resume as rr
    def boom(*a, **k): raise RuntimeError("Groq error 401: bad key")
    monkeypatch.setattr(rr, "create_resume", boom)
    r = create(client)
    assert r.status_code == 500 and "AI error" in r.json()["detail"]
    assert client.get("/api/history").json() == []        # nothing saved on failure


def test_create_resume_validation_422(client, ai):
    r = client.post("/api/resume/create", json={"target_role": "x"})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str) and "personal" in r.json()["detail"]
    r = create(client, target_role="   ")
    assert r.status_code == 422


def test_create_resume_unsafe_name_makes_safe_filename(client, ai):
    p = {**CREATE_PAYLOAD, "personal": {**CREATE_PAYLOAD["personal"], "name": "../../evil/na<me>"}}
    assert client.post("/api/resume/create", json=p).status_code == 200
    stored = client.get("/api/files").json()[0]["stored_name"]
    assert "/" not in stored and ".." not in stored.replace("_", "")


def test_download_docx(client, ai):
    aid = create(client).json()["attempt_id"]
    r = client.get(f"/api/resume/download/{aid}/docx")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert "Jane_Doe_Resume_" in r.headers["content-disposition"] and r.headers["content-disposition"].endswith('.docx"')
    text = "\n".join(p.text for p in Document(io.BytesIO(r.content)).paragraphs)
    assert "JANE DOE" in text and "Cut p95 latency" in text


def test_download_pdf(client, ai):
    aid = create(client).json()["attempt_id"]
    r = client.get(f"/api/resume/download/{aid}/pdf")
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    with pdfplumber.open(io.BytesIO(r.content)) as pdf:
        text = "\n".join(pg.extract_text() or "" for pg in pdf.pages)
    assert "JANE DOE" in text and "Senior Engineer" in text


def test_download_txt(client, ai):
    aid = create(client).json()["attempt_id"]
    r = client.get(f"/api/resume/download/{aid}/txt")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/plain")
    assert r.text == SAMPLE_RESUME
    assert 'attachment; filename="Jane_Doe_Resume_' in r.headers["content-disposition"]


def test_download_bad_format_400(client, ai):
    aid = create(client).json()["attempt_id"]
    assert client.get(f"/api/resume/download/{aid}/exe").status_code == 400


def test_download_unknown_attempt_404(client):
    assert client.get("/api/resume/download/9999/pdf").status_code == 404


def test_download_non_integer_id_422(client):
    assert client.get("/api/resume/download/abc/pdf").status_code == 422
