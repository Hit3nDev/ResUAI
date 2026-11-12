import io
import os

from docx import Document

from conftest import CREATE_PAYLOAD, SAMPLE_RESUME, make_docx, make_pdf


def make_attempt(client, ai):
    return client.post("/api/resume/create", json=CREATE_PAYLOAD).json()["attempt_id"]


# ───────────────────────────── history ─────────────────────────────


def test_history_empty(client):
    assert client.get("/api/history").json() == []
    assert client.get("/api/history/").json() == []


def test_history_both_slash_forms_no_redirect(client, ai):
    make_attempt(client, ai)
    for url in ("/api/history", "/api/history/"):
        r = client.get(url, follow_redirects=False)
        assert r.status_code == 200, (url, r.status_code, r.headers.get("location"))
        assert len(r.json()) == 1
    for url in ("/api/files", "/api/files/"):
        r = client.get(url, follow_redirects=False)
        assert r.status_code == 200, (url, r.status_code)


def test_history_list_get_fields(client, ai):
    aid = make_attempt(client, ai)
    row = client.get("/api/history").json()[0]
    assert set(row) == {"id", "feature", "input_summary", "output_preview", "full_output",
                        "ats_score", "timestamp", "metadata"}
    assert row["id"] == aid
    assert client.get(f"/api/history/{aid}").json()["full_output"] == SAMPLE_RESUME


def test_history_get_404(client):
    assert client.get("/api/history/12345").status_code == 404


def test_history_ordering_newest_first(client, ai):
    a, b = make_attempt(client, ai), make_attempt(client, ai)
    ids = [x["id"] for x in client.get("/api/history").json()]
    assert set(ids) == {a, b}


def test_history_delete_one_removes_attempt_and_files(client, ai):
    from database import UPLOAD_DIR
    aid = make_attempt(client, ai)
    assert os.listdir(UPLOAD_DIR)
    assert client.delete(f"/api/history/{aid}").json() == {"ok": True}
    assert client.get(f"/api/history/{aid}").status_code == 404
    assert client.get("/api/files").json() == []          # no orphaned file rows
    assert os.listdir(UPLOAD_DIR) == []


def test_history_delete_missing_is_ok(client):
    assert client.delete("/api/history/999").json() == {"ok": True}


def test_history_clear_all_both_slash_forms(client, ai):
    for url in ("/api/history", "/api/history/"):
        make_attempt(client, ai); make_attempt(client, ai)
        r = client.delete(url, follow_redirects=False)
        assert r.status_code == 200 and r.json() == {"ok": True}, url
        assert client.get("/api/history").json() == []
        assert client.get("/api/files").json() == []


def test_history_download_formats(client, ai):
    aid = make_attempt(client, ai)
    d = client.get(f"/api/history/{aid}/download/docx")
    assert d.status_code == 200 and d.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert any("JANE DOE" in p.text for p in Document(io.BytesIO(d.content)).paragraphs)
    p = client.get(f"/api/history/{aid}/download/pdf")
    assert p.headers["content-type"] == "application/pdf" and p.content.startswith(b"%PDF")
    t = client.get(f"/api/history/{aid}/download/txt")
    assert t.headers["content-type"].startswith("text/plain") and t.text == SAMPLE_RESUME
    assert "attachment" in t.headers["content-disposition"]
    assert client.get(f"/api/history/{aid}/download/bogus").status_code == 400
    assert client.get("/api/history/999/download/pdf").status_code == 404


def test_stats_endpoints(client, ai):
    empty = client.get("/api/stats").json()
    assert empty["total"] == 0 and empty["avg_ats_score"] is None and empty["total_file_size_human"] == "0 B"
    make_attempt(client, ai)
    client.post("/api/enhance/text", json={"resume_text": "John"})
    client.post("/api/ats/analyze", json={"resume_text": "x", "job_description": "y"})
    for url in ("/api/stats", "/api/history/stats"):
        s = client.get(url).json()
        assert s["total"] == 3 and s["created"] == 1 and s["enhanced"] == 1 and s["ats_checks"] == 1
        assert s["avg_ats_score"] == 82.0 and s["file_count"] == 3 and s["total_file_size"] > 0


# ───────────────────────────── files ─────────────────────────────


def test_files_upload_list_download_delete(client):
    r = client.post("/api/files/upload", files={"file": ("notes.txt", b"hello", "text/plain")},
                    data={"purpose": "misc"})
    assert r.status_code == 200
    rec = r.json()
    assert rec["filename"] == "notes.txt" and rec["file_size"] == 5 and rec["purpose"] == "misc"

    lst = client.get("/api/files").json()
    assert len(lst) == 1 and lst[0]["size_human"] == "5 B"

    d = client.get(f"/api/files/{rec['id']}/download")
    assert d.status_code == 200 and d.content == b"hello"
    assert d.headers["content-type"].startswith("text/plain")
    assert 'filename="notes.txt"' in d.headers["content-disposition"]

    assert client.delete(f"/api/files/{rec['id']}").json() == {"ok": True}
    assert client.get("/api/files").json() == []
    assert client.get(f"/api/files/{rec['id']}/download").status_code == 404


def test_files_download_missing_404(client):
    assert client.get("/api/files/999/download").status_code == 404


def test_files_download_row_without_disk_file_404(client):
    from database import UPLOAD_DIR
    rec = client.post("/api/files/upload", files={"file": ("a.txt", b"x", "text/plain")}).json()
    os.remove(os.path.join(UPLOAD_DIR, rec["stored_name"]))
    assert client.get(f"/api/files/{rec['id']}/download").status_code == 404


def test_files_upload_path_traversal_neutralised(client):
    from database import UPLOAD_DIR
    r = client.post("/api/files/upload",
                    files={"file": ("../../evil.txt", b"x", "text/plain")},
                    data={"purpose": "../../../escape"})
    assert r.status_code == 200
    stored = r.json()["stored_name"]
    assert "/" not in stored and "\\" not in stored
    assert os.path.exists(os.path.join(UPLOAD_DIR, stored))
    assert not os.path.exists(os.path.join(os.path.dirname(UPLOAD_DIR), "escape.txt"))
    assert r.json()["filename"] == "evil.txt"


def test_files_extract_text_txt_pdf_docx(client):
    r = client.post("/api/files/extract-text", files={"file": ("a.txt", b"one two three", "text/plain")})
    assert r.json() == {"text": "one two three", "word_count": 3, "filename": "a.txt"}
    r = client.post("/api/files/extract-text", files={"file": ("a.pdf", make_pdf(["alpha beta"]), "application/pdf")})
    assert r.status_code == 200 and "alpha beta" in r.json()["text"]
    r = client.post("/api/files/extract-text", files={"file": ("a.docx", make_docx(["gamma", "delta"]), "x")})
    assert r.json()["text"] == "gamma\ndelta" and r.json()["word_count"] == 2
    assert len(client.get("/api/files").json()) == 3


def test_files_extract_text_errors(client):
    assert client.post("/api/files/extract-text", files={"file": ("a.exe", b"x", "x")}).status_code == 400
    assert client.post("/api/files/extract-text", files={"file": ("a.txt", b"", "x")}).status_code == 400
    assert client.post("/api/files/extract-text", files={"file": ("a.pdf", b"junk", "x")}).status_code == 400
    assert client.get("/api/files").json() == []          # failed extractions are not stored


def test_files_upload_too_large_for_extract_400(client):
    big = b"a" * (10 * 1024 * 1024 + 1)
    r = client.post("/api/files/extract-text", files={"file": ("big.txt", big, "text/plain")})
    assert r.status_code == 400 and "too large" in r.json()["detail"]


def test_files_upload_missing_file_422(client):
    assert client.post("/api/files/upload").status_code == 422
