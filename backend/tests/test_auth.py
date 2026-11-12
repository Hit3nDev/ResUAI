import time

import pytest
from jose import jwt

import auth


def signup(client, email="a@example.com", pw="password123", confirm=None):
    return client.post("/api/auth/signup", json={
        "email": email, "password": pw, "confirm_password": pw if confirm is None else confirm})


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_signup_ok_returns_token_and_user(client):
    r = signup(client)
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer" and body["access_token"]
    assert body["user"]["email"] == "a@example.com" and body["user"]["id"]


@pytest.mark.parametrize("email", [
    "a@mail.co.uk", "first.last+tag@sub.domain.example.com", "x_y-z@my-site.io", "UPPER@Example.COM",
    "o'brien@example.com",
])
def test_signup_accepts_valid_emails(client, email):
    r = signup(client, email=email)
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"] == email.lower()


@pytest.mark.parametrize("email", ["", "plain", "a@b", "a@@b.com", "a b@c.com", "@x.com", "a@.com", "a@x..com"])
def test_signup_rejects_bad_emails(client, email):
    r = signup(client, email=email)
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)    # frontend does new Error(detail)


def test_signup_duplicate_case_insensitive(client):
    assert signup(client, "dup@example.com").status_code == 200
    r = signup(client, "DUP@example.com")
    assert r.status_code == 409 and "already exists" in r.json()["detail"]


def test_signup_short_password(client):
    r = signup(client, pw="short")
    assert r.status_code == 422 and "8 characters" in r.json()["detail"]


def test_signup_password_mismatch(client):
    r = signup(client, pw="password123", confirm="different123")
    assert r.status_code == 422 and "do not match" in r.json()["detail"]


def test_signup_password_over_bcrypt_limit_is_422_not_500(client):
    r = signup(client, pw="a" * 100)
    assert r.status_code == 422


def test_signup_unicode_password_roundtrip(client):
    assert signup(client, "u@example.com", pw="pässwörd-ñ-123").status_code == 200
    r = client.post("/api/auth/login", json={"email": "u@example.com", "password": "pässwörd-ñ-123"})
    assert r.status_code == 200


def test_login_ok_and_email_normalised(client):
    signup(client, "login@example.com")
    r = client.post("/api/auth/login", json={"email": "  LOGIN@example.com ", "password": "password123"})
    assert r.status_code == 200 and r.json()["access_token"]


def test_login_wrong_password(client):
    signup(client, "w@example.com")
    r = client.post("/api/auth/login", json={"email": "w@example.com", "password": "nope-nope"})
    assert r.status_code == 401 and r.json()["detail"] == "Invalid email or password."


def test_login_unknown_user_same_message(client):
    r = client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "whatever1"})
    assert r.status_code == 401 and r.json()["detail"] == "Invalid email or password."


def test_login_missing_fields_422(client):
    assert client.post("/api/auth/login", json={"email": "x@y.com"}).status_code == 422


def test_me_with_valid_token(client, auth_headers):
    r = client.get("/api/auth/me", headers=auth_headers)
    assert r.status_code == 200 and r.json()["email"] == "user@example.com"
    assert "password_hash" not in r.json()


def test_me_without_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_garbage_token(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


def test_me_expired_token(client):
    uid = signup(client, "e@example.com").json()["user"]["id"]
    expired = jwt.encode({"sub": uid, "exp": int(time.time()) - 10}, auth.SECRET_KEY, algorithm="HS256")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired}"}).status_code == 401


def test_me_token_signed_with_other_secret(client):
    uid = signup(client, "o@example.com").json()["user"]["id"]
    bad = jwt.encode({"sub": uid, "exp": int(time.time()) + 600}, "other-secret", algorithm="HS256")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_me_token_without_sub_is_401_not_500(client):
    tok = jwt.encode({"exp": int(time.time()) + 600}, auth.SECRET_KEY, algorithm="HS256")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_me_token_for_deleted_user(client):
    tok = auth.create_access_token("00000000-0000-0000-0000-000000000000", "gone@example.com")
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


def test_saved_resumes_require_auth(client):
    assert client.get("/api/auth/resumes").status_code == 401
    r = client.post("/api/auth/resumes/save", json={"attempt_id": 1, "title": "t", "resume_text": "x"})
    assert r.status_code == 401


def test_save_and_list_resumes_scoped_per_user(client, auth_headers):
    r = client.post("/api/auth/resumes/save", headers=auth_headers,
                    json={"attempt_id": 1, "title": "Mine", "resume_text": "TEXT"})
    assert r.status_code == 200 and r.json()["saved"] is True and r.json()["resume_id"]
    lst = client.get("/api/auth/resumes", headers=auth_headers).json()
    assert [x["title"] for x in lst] == ["Mine"] and lst[0]["resume_data"] == "TEXT"

    other = client.post("/api/auth/signup", json={
        "email": "other@example.com", "password": "password123", "confirm_password": "password123"}).json()
    h2 = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get("/api/auth/resumes", headers=h2).json() == []


def test_get_optional_user():
    assert auth.get_optional_user(None) is None
