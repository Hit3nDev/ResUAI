import io
import json

import pdfplumber

from conftest import SAMPLE_ATS, SAMPLE_RESUME, make_docx, make_pdf

# ───────────────────────────── ENHANCE ─────────────────────────────


def test_enhance_text_ok_and_focus_passed(client, ai):
    r = client.post("/api/enhance/text", json={
        "resume_text": "John Doe\nDeveloper", "job_title": "SRE", "job_description": "Run prod",
        "enhance_focus": ["Stronger action verbs", "Improve summary"]})
    assert r.status_code == 200
    b = r.json()
    assert b["enhanced_text"].startswith("ENHANCED") and b["cover_letter"] is None
    assert b["original_word_count"] == 3 and b["enhanced_word_count"] == len(b["enhanced_text"].split())
    call = ai["enhance"][0]
    assert call["focus"] == ["Stronger action verbs", "Improve summary"]
    assert call["job_title"] == "SRE" and call["jd"] == "Run prod"
    h = client.get(f"/api/history/{b['attempt_id']}").json()
    assert h["feature"] == "Enhance Resume" and json.loads(h["metadata"])["focus"] == call["focus"]


def test_enhance_text_with_cover_letter_persisted(client, ai):
    r = client.post("/api/enhance/text", json={
        "resume_text": "John Doe", "generate_cover_letter": True, "company_name": "Initech",
        "cover_tone": "Confident & Bold", "job_title": "SRE"})
    assert r.status_code == 200 and r.json()["cover_letter"].startswith("Dear")
    assert ai["cover"][0]["company"] == "Initech" and ai["cover"][0]["jd"] == "Role: SRE"
    assert "Enhanced_CoverLetter.txt" in [f["filename"] for f in client.get("/api/files").json()]


def test_enhance_text_cover_letter_failure_nonfatal(client, ai, monkeypatch):
    from routes import enhance as re_
    def boom(*a, **k): raise RuntimeError("x")
    monkeypatch.setattr(re_, "generate_cover_letter", boom)
    r = client.post("/api/enhance/text", json={"resume_text": "John", "generate_cover_letter": True})
    assert r.status_code == 200 and r.json()["cover_letter"] is None


def test_enhance_text_ai_failure_500(client, ai, monkeypatch):
    from routes import enhance as re_
    def boom(*a, **k): raise RuntimeError("rate limited")
    monkeypatch.setattr(re_, "enhance_resume", boom)
    r = client.post("/api/enhance/text", json={"resume_text": "John"})
    assert r.status_code == 500 and "rate limited" in r.json()["detail"]


def test_enhance_text_empty_422(client, ai):
    assert client.post("/api/enhance/text", json={"resume_text": "   "}).status_code == 422
    assert client.post("/api/enhance/text", json={}).status_code == 422


def test_enhance_upload_txt(client, ai):
    r = client.post("/api/enhance/upload",
                    files={"file": ("cv.txt", b"John Doe\nEngineer", "text/plain")},
                    data={"job_title": "SRE", "enhance_focus": "Improve summary, Skills section"})
    assert r.status_code == 200
    b = r.json()
    assert b["original_text"] == "John Doe\nEngineer" and b["cover_letter"] is None
    assert ai["enhance"][0]["focus"] == ["Improve summary", "Skills section"]
    assert "cv.txt" in [f["filename"] for f in client.get("/api/files").json()]


def test_enhance_upload_docx_with_cover_letter(client, ai):
    data = make_docx(["Jane Doe", "Engineer at Acme"])
    r = client.post("/api/enhance/upload",
                    files={"file": ("cv.docx", data, "application/octet-stream")},
                    data={"generate_cover_letter": "true", "company_name": "Initech", "cover_tone": "Friendly"})
    assert r.status_code == 200
    assert "Jane Doe" in r.json()["original_text"] and r.json()["cover_letter"]
    assert ai["cover"][0]["tone"] == "Friendly"


def test_enhance_upload_pdf(client, ai):
    data = make_pdf(["Jane Doe", "Senior Engineer"])
    r = client.post("/api/enhance/upload", files={"file": ("cv.pdf", data, "application/pdf")})
    assert r.status_code == 200 and "Senior Engineer" in r.json()["original_text"]


def test_enhance_upload_unsupported_extension_400(client, ai):
    r = client.post("/api/enhance/upload", files={"file": ("cv.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 400 and "Unsupported" in r.json()["detail"]
    assert ai["enhance"] == []


def test_enhance_upload_corrupt_pdf_400(client, ai):
    r = client.post("/api/enhance/upload", files={"file": ("cv.pdf", b"not a pdf at all", "application/pdf")})
    assert r.status_code == 400


def test_enhance_upload_empty_file_400(client, ai):
    assert client.post("/api/enhance/upload", files={"file": ("cv.txt", b"", "text/plain")}).status_code == 400
    assert client.post("/api/enhance/upload", files={"file": ("cv.txt", b"   \n ", "text/plain")}).status_code == 400


def test_enhance_upload_no_file_422(client):
    assert client.post("/api/enhance/upload", data={"job_title": "x"}).status_code == 422


def test_enhance_download_all_formats(client, ai):
    aid = client.post("/api/enhance/text", json={"resume_text": "John Doe"}).json()["attempt_id"]
    d = client.get(f"/api/enhance/download/{aid}/docx")
    assert d.status_code == 200 and d.content[:2] == b"PK"
    p = client.get(f"/api/enhance/download/{aid}/pdf")
    assert p.status_code == 200 and p.content.startswith(b"%PDF")
    t = client.get(f"/api/enhance/download/{aid}/txt")
    assert t.status_code == 200 and t.text.startswith("ENHANCED")
    assert client.get(f"/api/enhance/download/{aid}/zip").status_code == 400
    assert client.get("/api/enhance/download/999/pdf").status_code == 404


# ───────────────────────────── ATS ─────────────────────────────


def test_ats_analyze_ok(client, ai):
    r = client.post("/api/ats/analyze", json={"resume_text": SAMPLE_RESUME, "job_description": "Python, AWS"})
    assert r.status_code == 200
    b = r.json()
    for k in ("overall_score", "keyword_score", "format_score", "relevance_score", "matched_keywords",
              "missing_keywords", "strengths", "improvements", "section_scores", "verdict", "attempt_id"):
        assert k in b
    assert b["overall_score"] == 82 and b["verdict"] == "Good"


def test_ats_analyze_saves_readable_report_and_score(client, ai):
    aid = client.post("/api/ats/analyze", json={"resume_text": "x", "job_description": "y"}).json()["attempt_id"]
    h = client.get(f"/api/history/{aid}").json()
    assert h["ats_score"] == 82 and h["feature"] == "ATS Checker"
    assert h["full_output"].startswith("ATS COMPATIBILITY REPORT") and "Kubernetes" in h["full_output"]
    assert "{'" not in h["full_output"]                      # not a Python repr
    assert json.loads(h["metadata"])["overall_score"] == 82
    assert "ATS_Report.txt" in [f["filename"] for f in client.get("/api/files").json()]


def test_ats_history_download_is_usable(client, ai):
    aid = client.post("/api/ats/analyze", json={"resume_text": "x", "job_description": "y"}).json()["attempt_id"]
    t = client.get(f"/api/history/{aid}/download/txt")
    assert "ATS COMPATIBILITY REPORT" in t.text
    pdf = client.get(f"/api/history/{aid}/download/pdf")
    with pdfplumber.open(io.BytesIO(pdf.content)) as doc:
        assert "ATS" in (doc.pages[0].extract_text() or "")


def test_ats_normalises_bad_ai_values(client, ai, monkeypatch):
    from routes import ats
    monkeypatch.setattr(ats, "check_ats", lambda *a: {
        "overall_score": "93.6", "keyword_score": 250, "format_score": None, "relevance_score": -5,
        "matched_keywords": "oops", "missing_keywords": None, "strengths": [1, 2], "section_scores": [1]})
    b = client.post("/api/ats/analyze", json={"resume_text": "x", "job_description": "y"}).json()
    assert b["overall_score"] == 94 and b["keyword_score"] == 100 and b["format_score"] == 0
    assert b["relevance_score"] == 0 and b["matched_keywords"] == [] and b["strengths"] == ["1", "2"]
    assert b["section_scores"] == {} and b["verdict"] == ""


def test_ats_malformed_ai_json_500(client, ai, monkeypatch):
    from routes import ats
    def bad(*a): raise ValueError("AI returned malformed ATS JSON")
    monkeypatch.setattr(ats, "check_ats", bad)
    r = client.post("/api/ats/analyze", json={"resume_text": "x", "job_description": "y"})
    assert r.status_code == 500 and "ATS analysis error" in r.json()["detail"]
    assert client.get("/api/history").json() == []


def test_ats_ai_returns_non_object_500(client, ai, monkeypatch):
    from routes import ats
    monkeypatch.setattr(ats, "check_ats", lambda *a: ["not", "a", "dict"])
    assert client.post("/api/ats/analyze", json={"resume_text": "x", "job_description": "y"}).status_code == 500


def test_ats_analyze_validation(client, ai):
    assert client.post("/api/ats/analyze", json={"resume_text": "x"}).status_code == 422
    assert client.post("/api/ats/analyze", json={"resume_text": " ", "job_description": "y"}).status_code == 422


def test_ats_upload_with_jd_text_saves_report(client, ai):
    r = client.post("/api/ats/upload", files={"resume": ("cv.txt", b"John Doe python", "text/plain")},
                    data={"job_description_text": "Needs python"})
    assert r.status_code == 200 and r.json()["overall_score"] == 82
    assert ai["ats"][0] == ("John Doe python", "Needs python")
    names = [f["filename"] for f in client.get("/api/files").json()]
    assert "cv.txt" in names and "ATS_Report.txt" in names
    h = client.get(f"/api/history/{r.json()['attempt_id']}").json()
    assert h["full_output"].startswith("ATS COMPATIBILITY REPORT")


def test_ats_upload_with_jd_file(client, ai):
    r = client.post("/api/ats/upload",
                    files={"resume": ("cv.pdf", make_pdf(["Jane Doe python"]), "application/pdf"),
                           "job_description_file": ("jd.docx", make_docx(["We need Kubernetes"]), "application/octet-stream")})
    assert r.status_code == 200
    assert "Kubernetes" in ai["ats"][0][1] and "Jane Doe" in ai["ats"][0][0]


def test_ats_upload_missing_jd_400(client, ai):
    r = client.post("/api/ats/upload", files={"resume": ("cv.txt", b"John", "text/plain")})
    assert r.status_code == 400 and "Job description" in r.json()["detail"]
    r = client.post("/api/ats/upload", files={"resume": ("cv.txt", b"John", "text/plain")},
                    data={"job_description_text": "   "})
    assert r.status_code == 400


def test_ats_upload_bad_files_400(client, ai):
    r = client.post("/api/ats/upload", files={"resume": ("cv.xyz", b"John", "text/plain")},
                    data={"job_description_text": "jd"})
    assert r.status_code == 400 and "Resume parse error" in r.json()["detail"]
    r = client.post("/api/ats/upload", files={"resume": ("cv.txt", b"John", "text/plain"),
                                              "job_description_file": ("jd.xyz", b"x", "text/plain")})
    assert r.status_code == 400 and "JD parse error" in r.json()["detail"]
