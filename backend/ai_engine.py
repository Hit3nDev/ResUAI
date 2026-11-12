"""
ai_engine.py
Supports three free/paid providers auto-detected by API key prefix:
  gsk_...   → Groq      (FREE  — llama-3.3-70b-versatile)
  AIza...   → Gemini    (FREE  — gemini-1.5-flash)
  sk-ant-...→ Anthropic (PAID  — claude-sonnet-4)
"""

import json
import re
import requests

# ─── Provider detection ────────────────────────────────────────────────────────
def _detect_provider(api_key: str) -> str:
    k = api_key.strip()
    if k.startswith("gsk_"):   return "groq"
    if k.startswith("AIza"):   return "gemini"
    if k.startswith("sk-ant"): return "anthropic"
    # Default: try Groq (most common free option)
    return "groq"


# ─── Unified chat call ─────────────────────────────────────────────────────────
def _chat(api_key: str, prompt: str, max_tokens: int = 2000) -> str:
    provider = _detect_provider(api_key)

    if provider == "groq":
        return _groq_chat(api_key, prompt, max_tokens)
    elif provider == "gemini":
        return _gemini_chat(api_key, prompt, max_tokens)
    else:
        return _anthropic_chat(api_key, prompt, max_tokens)


# ─── Groq (FREE) ───────────────────────────────────────────────────────────────
def _groq_chat(api_key: str, prompt: str, max_tokens: int) -> str:
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Groq error {resp.status_code}: {resp.text}")
    return resp.json()["choices"][0]["message"]["content"]


# ─── Google Gemini (FREE) ──────────────────────────────────────────────────────
def _gemini_chat(api_key: str, prompt: str, max_tokens: int) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.7}
    }
    resp = requests.post(url, json=payload, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Gemini error {resp.status_code}: {resp.text}")
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


# ─── Anthropic (PAID) ─────────────────────────────────────────────────────────
def _anthropic_chat(api_key: str, prompt: str, max_tokens: int) -> str:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}]
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Anthropic error {resp.status_code}: {resp.text}")
    return resp.json()["content"][0]["text"]


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def create_resume(api_key: str, user_data: dict) -> str:
    prompt = f"""You are an expert professional resume writer with 15+ years of experience.
Create a complete, polished, ATS-friendly resume based on the following information.

Candidate Information:
{json.dumps(user_data, indent=2)}

STRICT INSTRUCTIONS:
- Write a compelling professional summary (3-4 sentences)
- Use strong action verbs: Led, Developed, Achieved, Optimized, Engineered, Delivered, Implemented
- Quantify achievements wherever possible (e.g., "Increased revenue by 35%", "Managed team of 12")
- Format each section with headers in ALL CAPS followed by a line of dashes
- Sections order: SUMMARY, EXPERIENCE, EDUCATION, SKILLS, CERTIFICATIONS (if any), PROJECTS (if any)
- Keep content concise: 400-700 words total
- ATS-safe: plain text only, no tables, no graphics, no columns
- Use bullet points starting with • for experience bullets

Output ONLY the complete resume as clean plain text. No commentary before or after.
"""
    return _chat(api_key, prompt, max_tokens=2200)


def enhance_resume(api_key: str, resume_text: str, job_title: str = "", job_description: str = "",
                   focus: list = None) -> str:
    context = ""
    if job_title:
        context += f"\nTarget Job Title: {job_title}"
    if job_description:
        context += f"\nTarget Job Description (align language to this):\n{job_description[:2000]}"
    focus = [f.strip() for f in (focus or []) if isinstance(f, str) and f.strip()]
    if focus:
        context += "\n\nFOCUS AREAS (prioritise these improvements):\n" + "\n".join(f"- {f}" for f in focus)

    prompt = f"""You are an expert professional resume writer and career coach.
Enhance the following resume to make it more impactful, professional, and ATS-friendly.
{context}

ORIGINAL RESUME:
{resume_text}

ENHANCEMENT INSTRUCTIONS:
- Rewrite ALL bullet points using strong action verbs (Led, Developed, Achieved, Optimized, Delivered, Engineered)
- Add quantifiable metrics wherever reasonable — use realistic numbers if implied
- Strengthen the professional summary to be compelling and specific
- Eliminate weak/passive language ("responsible for", "helped with", "assisted in")
- Ensure clear section headers in ALL CAPS
- If a job description was provided, naturally weave in matching keywords
- Fix any grammar or formatting issues
- Preserve ALL factual information — never invent new jobs, degrees, or credentials
- Output in the same structure as the input resume

Output ONLY the complete enhanced resume as clean plain text. No commentary.
"""
    return _chat(api_key, prompt, max_tokens=2500)


def check_ats(api_key: str, resume_text: str, job_description: str) -> dict:
    prompt = f"""You are an ATS (Applicant Tracking System) expert and resume analyzer.
Analyze the resume against the job description and return a JSON report.

RESUME:
{resume_text[:3000]}

JOB DESCRIPTION:
{job_description[:2000]}

Return ONLY a valid JSON object with this EXACT structure. No markdown fences, no commentary, pure JSON:
{{
  "overall_score": <integer 0-100>,
  "keyword_score": <integer 0-100>,
  "format_score": <integer 0-100>,
  "relevance_score": <integer 0-100>,
  "matched_keywords": ["keyword1", "keyword2"],
  "missing_keywords": ["keyword1", "keyword2"],
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["improvement1", "improvement2", "improvement3"],
  "section_scores": {{
    "summary": <integer 0-100>,
    "experience": <integer 0-100>,
    "education": <integer 0-100>,
    "skills": <integer 0-100>
  }},
  "verdict": "Excellent"
}}

Rules:
- overall_score reflects how well this resume would pass ATS for THIS job
- matched_keywords: actual keywords from JD found in resume (5-15 items)
- missing_keywords: important JD keywords NOT in resume (5-10 items)
- verdict must be one of: Excellent, Good, Needs Improvement, Poor
- Return ONLY the JSON, nothing else
"""
    raw = _chat(api_key, prompt, max_tokens=1500)
    raw = raw.strip()
    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```\s*$", "", raw, flags=re.MULTILINE)
    raw = raw.strip()
    # Find JSON object in response
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        raw = match.group(0)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"AI returned malformed ATS JSON: {exc}") from exc


def generate_cover_letter(api_key: str, resume_text: str, job_description: str,
                           company_name: str = "", tone: str = "Professional") -> str:
    prompt = f"""You are an expert cover letter writer.
Write a compelling, personalized cover letter.

RESUME:
{resume_text[:2000]}

JOB DESCRIPTION:
{job_description[:1500]}

Company: {company_name or "the company"}
Tone: {tone}

INSTRUCTIONS:
- Opening paragraph: Strong hook that references the specific role and your top qualification
- Second paragraph: 2-3 specific achievements from the resume that directly match this job
- Third paragraph: Why this company specifically and what unique value you bring
- Closing: Confident call-to-action, request interview
- Length: 300-380 words total
- DO NOT start with "I am writing to apply..." or "I am excited to apply..."
- Mirror keywords naturally from the job description
- Sound human, not robotic

Output ONLY the cover letter as plain text. Include Dear Hiring Manager, body paragraphs, and sign-off.
"""
    return _chat(api_key, prompt, max_tokens=1000)


def get_provider_name(api_key: str) -> str:
    """Return human-readable provider name for display."""
    p = _detect_provider(api_key)
    return {"groq": "Groq (Llama 3.3 70B)", "gemini": "Google Gemini 1.5 Flash", "anthropic": "Anthropic Claude"}[p]
