# ResUAI — AI-Powered Resume Builder

> Build, enhance, and ATS-score resumes in seconds.  
> Next.js 14 + FastAPI + Groq Llama 3.3 70B · Free AI · JWT Auth

---

## Quick Start

### 1. Backend

```bash
cd resumeai/backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env — set GROQ_API_KEY and RESUAI_SECRET (required)

# Run the server
uvicorn main:app --reload --port 8000
# OR: python main.py
```

API: http://localhost:8000  
Docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd resumeai/frontend

npm install

# Optional: copy env file (only needed in production)
cp .env.example .env.local

npm run dev
```

App: http://localhost:3000

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ Yes | Free key from [console.groq.com](https://console.groq.com) |
| `RESUAI_SECRET` | ✅ Yes | JWT signing secret (min 32 chars) |
| `PORT` | No | HTTP port (default `10000` for Render) |
| `ALLOW_ORIGINS` | No | CORS origins, comma-separated (default `*`) |
| `DOCS_DISABLED` | No | Set to `1` to hide `/docs` in production |

Generate a secure `RESUAI_SECRET`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | Backend URL in production (e.g. `https://api.resuai.onrender.com`) |

---

## Deploy to Render.com

### Backend
1. New Web Service → connect repo → select `resumeai/backend`
2. Build command: `pip install -r requirements.txt`
3. Start command: `python main.py`
4. Add environment variables in the Render dashboard

### Frontend
1. New Web Service or Static Site → select `resumeai/frontend`
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Set `NEXT_PUBLIC_API_URL` to your backend Render URL

---

## Project Structure

```
resumeai/
├── .gitignore
├── README.md
├── backend/
│   ├── .env.example          ← copy to .env, fill in values
│   ├── .gitignore
│   ├── requirements.txt
│   ├── main.py               ← FastAPI app entrypoint
│   ├── config.py             ← env var loading + startup validation
│   ├── auth.py               ← JWT + bcrypt auth utilities
│   ├── ai_engine.py          ← AI provider logic (Groq/Gemini/Anthropic)
│   ├── database.py           ← SQLite helpers
│   ├── doc_generator.py      ← DOCX + PDF generation
│   ├── file_parser.py        ← PDF/DOCX/TXT text extraction
│   ├── uploads/              ← user file storage (not committed)
│   └── routes/
│       ├── auth.py           ← /api/auth/*
│       ├── resume.py         ← /api/resume/*
│       ├── enhance.py        ← /api/enhance/*
│       ├── ats.py            ← /api/ats/*
│       ├── history.py        ← /api/history/*
│       └── files.py          ← /api/files/*
└── frontend/
    ├── .env.example          ← copy to .env.local for production
    ├── package.json
    ├── next.config.js
    └── src/
        ├── app/              ← Next.js pages
        ├── components/       ← Navbar, Logo, DownloadGate
        ├── lib/
        │   ├── api.ts        ← all API calls
        │   └── AuthContext.tsx
        └── styles/
            └── globals.css
```

---

## Security Notes

- `GROQ_API_KEY` and `RESUAI_SECRET` **must** be set — the app refuses to start without them
- `.env` files are excluded by `.gitignore` — never commit them
- Passwords are hashed with bcrypt (direct, not via passlib)
- JWT tokens expire after 72 hours
- User uploads are stored in `backend/uploads/` which is `.gitignore`d
