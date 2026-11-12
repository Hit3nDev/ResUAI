const BASE = "/api";
const TOKEN_KEY = "resuai_token";

export type Fmt = "docx" | "pdf" | "txt";

/* ── helpers ──────────────────────────────────────────────────────────────── */

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

/** FastAPI sends `detail` as a string, or (422) as a list of {msg, loc}. Make both readable. */
export function formatDetail(detail: unknown, fallback = "Something went wrong"): string {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d: any) => {
        const msg = String(d?.msg ?? d ?? "").replace(/^Value error,\s*/i, "");
        const field = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : "";
        // Pydantic's "Field required" is meaningless without the field name
        return /required|missing/i.test(msg) && field ? `${field}: ${msg.toLowerCase()}` : msg;
      })
      .filter(Boolean);
    return msgs.length ? msgs.join(" · ") : fallback;
  }
  try { return JSON.stringify(detail); } catch { return fallback; }
}

async function parseError(res: Response): Promise<Error> {
  let detail: unknown;
  try { detail = (await res.json())?.detail; } catch { /* non-JSON body */ }
  const fallback =
    res.status === 502 || res.status === 503 || res.status === 504
      ? "The server isn't reachable right now. Is the backend running?"
      : `Request failed (${res.status})`;
  const err: Error & { status?: number } = new Error(formatDetail(detail, fallback));
  err.status = res.status;
  return err;
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  const token = getToken();
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (opts.body && !(opts.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...opts, headers });
  } catch {
    throw new Error("Can't reach the server. Check that the backend is running.");
  }
  if (!res.ok) throw await parseError(res);
  return res.json();
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

/** Fetch a file with the user's token and hand it to the browser as a download. */
export async function downloadFile(path: string, fallbackName: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(BASE + path, { headers });
  } catch {
    throw new Error("Can't reach the server. Check that the backend is running.");
  }
  if (!res.ok) throw await parseError(res);
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ── Types ────────────────────────────────────────────────────────────────── */

export interface CreateResult {
  resume_text: string; cover_letter?: string | null;
  attempt_id: number; word_count: number; char_count: number;
}
export interface EnhanceResult {
  enhanced_text: string; original_text?: string; cover_letter?: string | null;
  attempt_id: number; original_word_count: number; enhanced_word_count: number;
}
export interface ATSResult {
  overall_score: number; keyword_score: number; format_score: number; relevance_score: number;
  matched_keywords: string[]; missing_keywords: string[];
  strengths: string[]; improvements: string[];
  section_scores?: Record<string, number>; verdict: string; attempt_id: number;
}
export interface Attempt {
  id: number; feature: string; input_summary: string; output_preview: string;
  full_output: string; ats_score: number | null; timestamp: string; metadata?: string | null;
}
export interface Stats {
  total: number; created: number; enhanced: number; ats_checks: number;
  avg_ats_score: number | null; file_count: number; total_file_size_human?: string;
}
export interface SavedResume { id: number; attempt_id: number | null; title: string; resume_data: string; created_at: string }

/* ── Health ───────────────────────────────────────────────────────────────── */
export const getHealth = () => request<{ status: string; version: string }>("/health");

/* ── Resume builder ───────────────────────────────────────────────────────── */
export const createResume = (data: object) => request<CreateResult>("/resume/create", json(data));
export const downloadResume = (id: number, f: Fmt) => downloadFile(`/resume/download/${id}/${f}`, `Resume.${f}`);

/* ── Enhance ──────────────────────────────────────────────────────────────── */
export const enhanceText = (data: object) => request<EnhanceResult>("/enhance/text", json(data));
export const downloadEnhanced = (id: number, f: Fmt) => downloadFile(`/enhance/download/${id}/${f}`, `Enhanced_Resume.${f}`);

/* ── ATS ──────────────────────────────────────────────────────────────────── */
export const analyzeATS = (resumeText: string, jobDescription: string) =>
  request<ATSResult>("/ats/analyze", json({ resume_text: resumeText, job_description: jobDescription }));

/* ── History ──────────────────────────────────────────────────────────────── */
export const getHistory    = () => request<Attempt[]>("/history");
export const getStats      = () => request<Stats>("/stats");
export const deleteAttempt = (id: number) => request(`/history/${id}`, { method: "DELETE" });
export const clearHistory  = () => request("/history", { method: "DELETE" });
export const downloadFromHistory = (id: number, f: Fmt) => downloadFile(`/history/${id}/download/${f}`, `session_${id}.${f}`);

/* ── Files ────────────────────────────────────────────────────────────────── */
export async function extractText(file: File) {
  const fd = new FormData(); fd.append("file", file);
  return request<{ text: string; word_count: number; filename: string }>("/files/extract-text", { method: "POST", body: fd });
}

/* ── Auth ─────────────────────────────────────────────────────────────────── */
type AuthRes = { access_token: string; user: { id: string; email: string } };

export const authSignup = (email: string, password: string, confirmPassword: string) =>
  request<AuthRes>("/auth/signup", json({ email, password, confirm_password: confirmPassword }));
export const authLogin = (email: string, password: string) =>
  request<AuthRes>("/auth/login", json({ email, password }));
export const authMe = () => request<{ id: string; email: string; created_at: string }>("/auth/me");
export const saveResumeToAccount = (attemptId: number, title: string, resumeText: string) =>
  request<{ saved: boolean; resume_id: number }>("/auth/resumes/save", json({ attempt_id: attemptId, title, resume_text: resumeText }));
export const getMyResumes = () => request<SavedResume[]>("/auth/resumes");

/* ── Misc ─────────────────────────────────────────────────────────────────── */

/** Only allow same-site relative redirects (blocks ?redirect=https://evil.example and //evil.example). */
export function safeRedirect(target: string | null | undefined, fallback = "/"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
