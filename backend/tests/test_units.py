"""Unit tests: file_parser, doc_generator, ai_engine, config/db helpers."""
import io
import json

import pdfplumber
import pytest
from docx import Document

import ai_engine
import doc_generator as dg
from file_parser import extract_text_from_bytes, extract_text_from_upload
from conftest import SAMPLE_RESUME, make_docx, make_pdf


class Up:
    def __init__(self, name, data): self.name, self._d = name, data
    def read(self): return self._d


# ───────────────────────────── file_parser ─────────────────────────────

def test_parser_txt_utf8_and_latin1():
    assert extract_text_from_upload(Up("a.TXT", "café – ok".encode("utf-8"))) == "café – ok"
    assert extract_text_from_upload(Up("a.txt", "café".encode("latin-1"))) == "café"


def test_parser_pdf_real():
    assert "Hello World" in extract_text_from_upload(Up("a.pdf", make_pdf(["Hello World", "Second line"])))


def test_parser_docx_real_skips_blank_paragraphs():
    assert extract_text_from_upload(Up("a.docx", make_docx(["One", "", "  ", "Two"]))) == "One\nTwo"


def test_parser_unsupported():
    with pytest.raises(ValueError, match="Unsupported"):
        extract_text_from_upload(Up("a.rtf", b"x"))


def test_parser_bytes_helper_errors():
    with pytest.raises(ValueError, match="empty"):
        extract_text_from_bytes("a.txt", b"")
    with pytest.raises(ValueError, match="No readable text"):
        extract_text_from_bytes("a.txt", b"  \n")
    with pytest.raises(ValueError, match="Could not read"):
        extract_text_from_bytes("a.docx", b"not a zip")
    with pytest.raises(ValueError, match="Unsupported"):
        extract_text_from_bytes("", b"x")


# ───────────────────────────── doc_generator ─────────────────────────────

def kinds(text):
    return [(t.kind, t.text, t.extra) for t in dg.parse_resume(text)]


def test_parse_realistic_resume():
    toks = kinds(SAMPLE_RESUME)
    assert toks[0] == ("name", "JANE DOE", "")
    assert toks[1][0] == "contact" and "@" in toks[1][1]
    assert ("section", "SUMMARY", "") in toks
    assert ("entry_head", "Acme Corp", "Jan 2020 – Present") in toks
    assert ("entry_sub", "Senior Engineer", "Austin, TX") in toks
    assert ("bullet", "Cut p95 latency by 40% across 12 services", "") in toks
    assert ("skill", "Languages: Python, Go, SQL", "") in toks
    # long summary sentence must not be mistaken for an entry heading
    assert ("body", "Backend engineer with 5 years of experience building reliable APIs.", "") in toks


def test_parse_summary_with_year_stays_body():
    t = "A B\na@b.com\n\nSUMMARY\nLed the 2019 platform migration for a team of ten engineers and shipped it on time.\n"
    assert [k for k, *_ in kinds(t)][-1] == "body"


@pytest.mark.parametrize("marker", ["•", "-", "*", "–"])
def test_parse_bullet_markers(marker):
    toks = kinds(f"A B\na@b.com\n\nEXPERIENCE\n{marker} Did a thing\n")
    assert ("bullet", "Did a thing", "") in toks


def test_parse_strips_markdown_and_controls():
    toks = kinds("**JANE DOE**\nj@x.com\n\n## EXPERIENCE\n• Did\x00 a **big** thing\x0b\n")
    assert toks[0][1] == "JANE DOE"
    assert ("section", "EXPERIENCE", "") in toks
    assert ("bullet", "Did a big thing", "") in toks


NASTY = [
    "",
    "   \n\n  ",
    "ONLY A NAME",
    "R&D <Lab> \"Quotes\" 'single' & more\nj@x.com | 555 0100\n\nSKILLS\nLanguages: C++, C#, <b>bold</b>, A&B\nEXPERIENCE\nR&D Corp   Jan 2020 – Present\nLead <Engineer>   NY, NY\n• Reduced cost by 30% & improved <latency> > 2x\n",
    "José Ñandú\nj@x.com\n\nSUMMARY\nÜber-engineer – naïve café résumé → ✓ done ● ok\n",
    "NAME\nj@x.com\n\nSUMMARY\n" + ("word " * 3000) + "\n",
    "NAME\nj@x.com\n\nEXPERIENCE\n• " + ("x" * 5000) + "\n",
    "NAME\n\x00\x01\x02\x7f\nSUMMARY\ntext\n",
    "</para><b>unclosed\nj@x.com\n\nSKILLS\n<font color=red>x</font>: <i>y\n",
    "日本語の名前\nj@x.com\n\nSUMMARY\n中文 हिन्दी العربية\n",
]


@pytest.mark.parametrize("text", NASTY, ids=range(len(NASTY)))
def test_generate_docx_never_crashes(text):
    data = dg.generate_docx(text)
    assert data[:2] == b"PK"
    Document(io.BytesIO(data))      # opens cleanly


@pytest.mark.parametrize("text", NASTY, ids=range(len(NASTY)))
def test_generate_pdf_never_crashes(text):
    data = dg.generate_pdf(text)
    assert data.startswith(b"%PDF")
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        assert len(pdf.pages) >= 1


def test_pdf_preserves_special_characters_literally():
    data = dg.generate_pdf(NASTY[3])
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        text = "\n".join(p.extract_text() or "" for p in pdf.pages)
    assert "R&D Corp" in text and "<latency>" in text and "A&B" in text and "<b>bold</b>" in text


def test_pdf_and_docx_unicode_latin_text_survives():
    with pdfplumber.open(io.BytesIO(dg.generate_pdf(NASTY[4]))) as pdf:
        assert "naïve café résumé" in (pdf.pages[0].extract_text() or "")
    paras = "\n".join(p.text for p in Document(io.BytesIO(dg.generate_docx(NASTY[4]))).paragraphs)
    assert "naïve café résumé" in paras


def test_long_resume_paginates():
    big = "NAME\nj@x.com\n\nEXPERIENCE\n" + "\n".join(f"• line number {i} with some words" for i in range(200))
    with pdfplumber.open(io.BytesIO(dg.generate_pdf(big))) as pdf:
        assert len(pdf.pages) > 1


def test_download_filename_sanitised():
    n = dg.get_download_filename("Jane O'Neil/../x", "Enhance Resume", "pdf")
    assert n.endswith(".pdf") and "/" not in n and "'" not in n and "Enhance_Resume" in n
    assert dg.get_download_filename("", "Resume", "txt").startswith("Resume_Resume_")


# ───────────────────────────── ai_engine ─────────────────────────────

@pytest.mark.parametrize("key,prov", [
    ("gsk_abc", "groq"), ("AIzaXYZ", "gemini"), ("sk-ant-api03-x", "anthropic"), ("whatever", "groq"), ("  gsk_x ", "groq"),
])
def test_provider_detection(key, prov):
    assert ai_engine._detect_provider(key) == prov
    assert ai_engine.get_provider_name(key)


class FakeResp:
    def __init__(self, status=200, payload=None, text=""):
        self.status_code, self._p, self.text = status, payload or {}, text
    def json(self): return self._p


def groq_reply(content):
    return FakeResp(200, {"choices": [{"message": {"content": content}}]})


def test_chat_routes_to_each_provider(monkeypatch):
    seen = {}
    def fake_post(url, **kw):
        seen["url"], seen["kw"] = url, kw
        if "groq" in url: return groq_reply("G")
        if "generativelanguage" in url: return FakeResp(200, {"candidates": [{"content": {"parts": [{"text": "Gem"}]}}]})
        return FakeResp(200, {"content": [{"text": "Cl"}]})
    monkeypatch.setattr(ai_engine.requests, "post", fake_post)
    assert ai_engine._chat("gsk_1", "hi") == "G" and seen["kw"]["headers"]["Authorization"] == "Bearer gsk_1"
    assert ai_engine._chat("AIza1", "hi") == "Gem"
    assert ai_engine._chat("sk-ant-1", "hi") == "Cl" and seen["kw"]["headers"]["x-api-key"] == "sk-ant-1"


def test_chat_http_error_raises(monkeypatch):
    monkeypatch.setattr(ai_engine.requests, "post", lambda *a, **k: FakeResp(429, text="rate limit"))
    with pytest.raises(RuntimeError, match="429"):
        ai_engine._chat("gsk_1", "hi")


GOOD = {"overall_score": 70, "keyword_score": 60, "format_score": 80, "relevance_score": 75,
        "matched_keywords": ["a"], "missing_keywords": ["b"], "strengths": ["s"], "improvements": ["i"],
        "section_scores": {"summary": 1}, "verdict": "Good"}


@pytest.mark.parametrize("wrap", [
    "{j}",
    "```json\n{j}\n```",
    "```\n{j}\n```",
    "Here is the report:\n{j}\nHope that helps!",
    "   \n```JSON\n{j}```  ",
])
def test_check_ats_parses_fenced_and_chatty_json(monkeypatch, wrap):
    monkeypatch.setattr(ai_engine.requests, "post", lambda *a, **k: groq_reply(wrap.replace("{j}", json.dumps(GOOD))))
    assert ai_engine.check_ats("gsk_1", "resume", "jd") == GOOD


def test_check_ats_malformed_raises_valueerror(monkeypatch):
    monkeypatch.setattr(ai_engine.requests, "post", lambda *a, **k: groq_reply("{not json: true,}"))
    with pytest.raises(ValueError, match="malformed"):
        ai_engine.check_ats("gsk_1", "r", "jd")
    monkeypatch.setattr(ai_engine.requests, "post", lambda *a, **k: groq_reply("no json at all"))
    with pytest.raises(ValueError):
        ai_engine.check_ats("gsk_1", "r", "jd")


def test_enhance_prompt_includes_focus_and_context(monkeypatch):
    sent = {}
    def fake_post(url, **kw):
        sent["prompt"] = kw["json"]["messages"][0]["content"]
        return groq_reply("ok")
    monkeypatch.setattr(ai_engine.requests, "post", fake_post)
    ai_engine.enhance_resume("gsk_1", "RESUME BODY", "SRE", "Run prod", focus=["Stronger action verbs", " ", "Skills section"])
    p = sent["prompt"]
    assert "FOCUS AREAS" in p and "- Stronger action verbs" in p and "- Skills section" in p
    assert "Target Job Title: SRE" in p and "RESUME BODY" in p
    ai_engine.enhance_resume("gsk_1", "R")                    # backward compatible, no focus
    assert "FOCUS AREAS" not in sent["prompt"]
    ai_engine.enhance_resume("gsk_1", "R", focus=[])
    assert "FOCUS AREAS" not in sent["prompt"]


def test_create_resume_and_cover_letter_prompts(monkeypatch):
    sent = []
    monkeypatch.setattr(ai_engine.requests, "post", lambda u, **kw: (sent.append(kw["json"]["messages"][0]["content"]), groq_reply("T"))[1])
    assert ai_engine.create_resume("gsk_1", {"personal": {"name": "Zed"}}) == "T"
    assert "Zed" in sent[0]
    assert ai_engine.generate_cover_letter("gsk_1", "R", "JD", "Initech", "Friendly") == "T"
    assert "Initech" in sent[1] and "Friendly" in sent[1]
    ai_engine.generate_cover_letter("gsk_1", "R", "JD")
    assert "the company" in sent[2]


# ───────────────────────────── config / db ─────────────────────────────

def test_config_validate_exits_without_env(monkeypatch, capsys):
    import config
    monkeypatch.setattr(config, "GROQ_API_KEY", "")
    monkeypatch.setattr(config, "RESUAI_SECRET", "")
    with pytest.raises(SystemExit):
        config.validate()
    assert "GROQ_API_KEY" in capsys.readouterr().err


def test_auth_uses_config_secret_and_db_override():
    import auth, config, database, os
    assert auth.SECRET_KEY == config.RESUAI_SECRET != ""
    assert auth.DB_PATH == database.DB_PATH == os.environ["RESUAI_DB_PATH"]


def test_format_file_size():
    from database import format_file_size
    assert format_file_size(10) == "10 B" and format_file_size(2048) == "2.0 KB" and format_file_size(3 * 1024 * 1024) == "3.0 MB"


def test_dotenv_loaded_from_backend_env(tmp_path, monkeypatch):
    """config.py must read backend/.env without overriding real env vars."""
    import subprocess, sys, os
    backend = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    code = ("import sys; sys.path.insert(0, %r); import config; "
            "print(config.GROQ_API_KEY, config.RESUAI_SECRET)" % backend)
    env = {k: v for k, v in os.environ.items() if k not in ("GROQ_API_KEY", "RESUAI_SECRET")}
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, env=env).stdout.split()
    if os.path.exists(os.path.join(backend, ".env")):
        assert len(out) >= 1                 # values come from .env (not echoed here)
    env["RESUAI_SECRET"] = "explicit-wins"
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, env=env).stdout.split()
    assert out[-1] == "explicit-wins"
