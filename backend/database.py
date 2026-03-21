import sqlite3
import json
import os
import shutil
from datetime import datetime

BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DB_PATH    = os.path.normpath(os.path.join(BASE_DIR, "..", "resume_app.db"))
UPLOAD_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── Schema ─────────────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS attempts (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            feature        TEXT    NOT NULL,
            input_summary  TEXT,
            output_preview TEXT,
            full_output    TEXT,
            ats_score      INTEGER,
            timestamp      TEXT    NOT NULL,
            metadata       TEXT
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT    NOT NULL,
            stored_name TEXT    NOT NULL,
            file_type   TEXT,
            file_size   INTEGER,
            purpose     TEXT,
            attempt_id  INTEGER,
            timestamp   TEXT    NOT NULL,
            FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE SET NULL
        )
    """)
    conn.commit()
    conn.close()


# ─── Attempts ────────────────────────────────────────────────────────────────────
def save_attempt(feature, input_summary, output_preview, full_output,
                 ats_score=None, metadata=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO attempts
            (feature, input_summary, output_preview, full_output, ats_score, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (feature, input_summary, output_preview, full_output, ats_score,
          datetime.now().strftime("%Y-%m-%d %H:%M:%S"), json.dumps(metadata or {})))
    attempt_id = c.lastrowid
    conn.commit()
    conn.close()
    return attempt_id


def get_all_attempts():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT * FROM attempts ORDER BY timestamp DESC")
    rows = c.fetchall()
    conn.close()
    cols = ["id","feature","input_summary","output_preview","full_output","ats_score","timestamp","metadata"]
    return [dict(zip(cols, r)) for r in rows]


def get_attempt_by_id(attempt_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT * FROM attempts WHERE id = ?", (attempt_id,))
    row = c.fetchone()
    conn.close()
    if row:
        cols = ["id","feature","input_summary","output_preview","full_output","ats_score","timestamp","metadata"]
        return dict(zip(cols, row))
    return None


def delete_attempt(attempt_id):
    # Also delete associated files from disk
    files = get_files_for_attempt(attempt_id)
    for f in files:
        _delete_file_from_disk(f["stored_name"])
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM attempts WHERE id = ?", (attempt_id,))
    conn.commit()
    conn.close()


def clear_all_attempts():
    # Delete all stored files first
    all_files = get_all_files()
    for f in all_files:
        _delete_file_from_disk(f["stored_name"])
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM files")
    c.execute("DELETE FROM attempts")
    conn.commit()
    conn.close()


def get_stats():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM attempts");                                    total    = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM attempts WHERE feature='Create Resume'");      created  = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM attempts WHERE feature='Enhance Resume'");     enhanced = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM attempts WHERE feature='ATS Checker'");        ats      = c.fetchone()[0]
    c.execute("SELECT AVG(ats_score) FROM attempts WHERE ats_score IS NOT NULL");  avg      = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM files");                                       file_cnt = c.fetchone()[0]
    c.execute("SELECT SUM(file_size) FROM files");                                 total_sz = c.fetchone()[0]
    conn.close()
    return {
        "total": total, "created": created, "enhanced": enhanced,
        "ats_checks": ats, "avg_ats_score": round(avg, 1) if avg else None,
        "file_count": file_cnt, "total_file_size": total_sz or 0
    }


# ─── File Storage ────────────────────────────────────────────────────────────────
def save_file(file_bytes: bytes, original_filename: str, file_type: str,
              purpose: str = "upload", attempt_id: int = None) -> dict:
    """Save a file to disk and record it in the DB. Returns file record."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    ext = os.path.splitext(original_filename)[1].lower()
    stored_name = f"{ts}_{purpose}{ext}"
    file_path   = os.path.join(UPLOAD_DIR, stored_name)

    with open(file_path, "wb") as fh:
        fh.write(file_bytes)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO files (filename, stored_name, file_type, file_size, purpose, attempt_id, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (original_filename, stored_name, file_type, len(file_bytes), purpose,
          attempt_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    file_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"id": file_id, "filename": original_filename, "stored_name": stored_name,
            "file_size": len(file_bytes), "file_type": file_type, "purpose": purpose}


def save_output_file(content: str, filename: str, attempt_id: int = None) -> dict:
    """Save a generated text output as a .txt file."""
    file_bytes = content.encode("utf-8")
    return save_file(file_bytes, filename, "text/plain", purpose="output", attempt_id=attempt_id)


def get_file_bytes(stored_name: str) -> bytes | None:
    path = os.path.join(UPLOAD_DIR, stored_name)
    if os.path.exists(path):
        with open(path, "rb") as fh:
            return fh.read()
    return None


def get_all_files():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT * FROM files ORDER BY timestamp DESC")
    rows = c.fetchall()
    conn.close()
    cols = ["id","filename","stored_name","file_type","file_size","purpose","attempt_id","timestamp"]
    return [dict(zip(cols, r)) for r in rows]


def get_files_for_attempt(attempt_id: int):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT * FROM files WHERE attempt_id = ?", (attempt_id,))
    rows = c.fetchall()
    conn.close()
    cols = ["id","filename","stored_name","file_type","file_size","purpose","attempt_id","timestamp"]
    return [dict(zip(cols, r)) for r in rows]


def delete_file_record(file_id: int):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT stored_name FROM files WHERE id = ?", (file_id,))
    row = c.fetchone()
    if row:
        _delete_file_from_disk(row[0])
    c.execute("DELETE FROM files WHERE id = ?", (file_id,))
    conn.commit()
    conn.close()


def _delete_file_from_disk(stored_name: str):
    path = os.path.join(UPLOAD_DIR, stored_name)
    if os.path.exists(path):
        os.remove(path)


def format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes/1024:.1f} KB"
    else:
        return f"{size_bytes/(1024*1024):.1f} MB"
