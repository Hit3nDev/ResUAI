const BASE = "/api";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json", ...((opts.headers as object) || {}) },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Unknown error");
  }
  return res.json();
}

// ── Resume Builder ──────────────────────────────────────────────────────────────
export async function createResume(data: object) {
  return req<{
    resume_text: string; cover_letter?: string;
    attempt_id: number; word_count: number; char_count: number;
  }>("/resume/create", { method: "POST", body: JSON.stringify(data) });
}

export function downloadResume(attemptId: number, format: "docx" | "pdf" | "txt") {
  window.open(`${BASE}/resume/download/${attemptId}/${format}`, "_blank");
}

// ── Enhance ───────────────────────────────────────────────────────────────────
export async function enhanceText(data: object) {
  return req<{
    enhanced_text: string; original_text?: string;
    attempt_id: number; original_word_count: number; enhanced_word_count: number;
    cover_letter?: string;
  }>("/enhance/text", { method: "POST", body: JSON.stringify(data) });
}

export async function enhanceFile(file: File, jobTitle = "", jobDescription = "") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("job_title", jobTitle);
  fd.append("job_description", jobDescription);
  const res = await fetch(`${BASE}/enhance/upload`, { method: "POST", body: fd });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
  return res.json();
}

export function downloadEnhanced(attemptId: number, format: "docx" | "pdf" | "txt") {
  window.open(`${BASE}/enhance/download/${attemptId}/${format}`, "_blank");
}

// ── ATS ───────────────────────────────────────────────────────────────────────
export async function analyzeATS(resumeText: string, jobDescription: string) {
  return req<{
    overall_score: number; keyword_score: number; format_score: number;
    relevance_score: number; matched_keywords: string[]; missing_keywords: string[];
    strengths: string[]; improvements: string[];
    section_scores: Record<string, number>; verdict: string; attempt_id: number;
  }>("/ats/analyze", { method: "POST", body: JSON.stringify({ resume_text: resumeText, job_description: jobDescription }) });
}

export async function analyzeATSFile(resume: File, jdFile?: File, jdText = "") {
  const fd = new FormData();
  fd.append("resume", resume);
  if (jdFile) fd.append("job_description_file", jdFile);
  fd.append("job_description_text", jdText);
  const res = await fetch(`${BASE}/ats/upload`, { method: "POST", body: fd });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
  return res.json();
}

// ── History ───────────────────────────────────────────────────────────────────
export async function getHistory() {
  return req<any[]>("/history/");
}

export async function getStats() {
  return req<Record<string, any>>("/stats");
}

export async function deleteAttempt(id: number) {
  return req(`/history/${id}`, { method: "DELETE" });
}

export async function clearHistory() {
  return req("/history/", { method: "DELETE" });
}

export function downloadFromHistory(id: number, format: "docx" | "pdf" | "txt") {
  window.open(`${BASE}/history/${id}/download/${format}`, "_blank");
}

// ── Files ─────────────────────────────────────────────────────────────────────
export async function getFiles() {
  return req<any[]>("/files/");
}

export async function deleteFile(id: number) {
  return req(`/files/${id}`, { method: "DELETE" });
}

export async function extractText(file: File) {
  const fd = new FormData(); fd.append("file", file);
  const res = await fetch(`${BASE}/files/extract-text`, { method: "POST", body: fd });
  if (!res.ok) { const e = await res.json(); throw new Error(e.detail); }
  return res.json() as Promise<{ text: string; word_count: number; filename: string }>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("resuai_token");
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function authSignup(email: string, password: string, confirmPassword: string) {
  return req<{ access_token: string; user: { id: string; email: string } }>(
    "/auth/signup",
    { method: "POST", body: JSON.stringify({ email, password, confirm_password: confirmPassword }) }
  );
}

export async function authLogin(email: string, password: string) {
  return req<{ access_token: string; user: { id: string; email: string } }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) }
  );
}

export async function authMe() {
  return req<{ id: string; email: string; created_at: string }>(
    "/auth/me",
    { headers: authHeaders() }
  );
}

export async function saveResumeToAccount(attemptId: number, title: string, resumeText: string) {
  return req<{ saved: boolean; resume_id: number }>(
    "/auth/resumes/save",
    { method: "POST", body: JSON.stringify({ attempt_id: attemptId, title, resume_text: resumeText }), headers: authHeaders() }
  );
}

export async function getMyResumes() {
  return req<any[]>("/auth/resumes", { headers: authHeaders() });
}

/** Download with auth token injected (opens download URL). */
export function downloadWithAuth(url: string) {
  const token = getToken();
  if (!token) { window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`; return; }
  // Append token as query param so the browser can download
  window.open(`${url}?token=${token}`, "_blank");
}
