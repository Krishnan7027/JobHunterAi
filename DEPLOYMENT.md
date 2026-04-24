# Deployment Guide — AI Job Hunter

Free tier deployment: **Vercel** (frontend) + **Render** (backend) + **Neon** (PostgreSQL).

---

## 1. Database — Neon (Free PostgreSQL)

1. Go to [neon.tech](https://neon.tech) and create an account
2. Create a new project (e.g., `job-hunter`)
3. Copy the connection string — looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this — you'll need it for Render

---

## 2. Backend — Render (Free Web Service)

### Setup

1. Push your code to GitHub (if not already)
2. Go to [render.com](https://render.com) → New → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `job-hunter-api`
   - **Root Directory**: `backend`
   - **Runtime**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**:
     ```
     gunicorn app.main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 120
     ```

### Environment Variables (Render Dashboard)

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Neon connection string |
| `GEMINI_API_KEY` | Your Google AI Studio key |
| `JWT_SECRET` | Generate: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `FRONTEND_URL` | `https://your-app.vercel.app` (set after Vercel deploy) |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite-preview` |
| `PYTHON_VERSION` | `3.11.11` |

### Health Check

Set health check path to `/health` in Render dashboard.

### After Deploy

Your backend URL will be: `https://job-hunter-api.onrender.com`

Test: `curl https://job-hunter-api.onrender.com/api/health`

> **Note**: Render free tier spins down after 15min inactivity. First request after sleep takes ~30s.

---

## 3. Frontend — Vercel (Free)

### Setup

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`

### Environment Variables (Vercel Dashboard)

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://job-hunter-api.onrender.com/api` |

### After Deploy

1. Copy your Vercel URL (e.g., `https://my-job-hunter.vercel.app`)
2. Go back to Render → Environment → Update `FRONTEND_URL` to your Vercel URL
3. Redeploy Render to pick up the CORS change

---

## 4. Post-Deployment Checklist

- [ ] Backend health check: `curl https://YOUR-RENDER-URL/api/health`
- [ ] Frontend loads at Vercel URL
- [ ] Register a new account
- [ ] Login works (JWT token stored)
- [ ] Upload CV (parses via Gemini)
- [ ] Fetch jobs (Google scraper — Playwright not available on free tier)
- [ ] AI scoring works

---

## Architecture Notes

### What Changed for Cloud

| Component | Local | Cloud |
|-----------|-------|-------|
| Database | SQLite (file) | PostgreSQL via Neon |
| Cache | diskcache (disk) | In-memory (TTL dict) |
| File uploads | Local `uploads/` dir | Temp dir (`/tmp`) — ephemeral |
| Scraping | Playwright + httpx | httpx only (Playwright fallback to Google search) |
| Server | uvicorn dev | gunicorn + uvicorn workers |

### Playwright on Cloud

Playwright requires browser binaries (~400MB) which won't fit on Render free tier.
The scraper automatically falls back to Google search-based scraping when Playwright is unavailable.
Indeed and Naukri sources will use Google search proxying instead of direct Playwright scraping.

### File Uploads

CV uploads use `/tmp` which is ephemeral on Render. Files are parsed immediately then cleaned up.
The parsed data (skills, experience, etc.) is stored in PostgreSQL — the original file is not retained.

### Free Tier Limits

| Service | Limit |
|---------|-------|
| Neon | 0.5 GB storage, 190 compute hours/month |
| Render | 750 hours/month, sleeps after 15min idle |
| Vercel | 100 GB bandwidth, 1000 serverless invocations/day |
| Gemini | ~14 RPM free tier |

---

## Local Development (unchanged)

```bash
# Backend (SQLite — no Neon needed locally)
cd backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm install
npm run dev
```

Local `.env` still uses `DATABASE_URL=sqlite+aiosqlite:///./job_hunter.db` — no changes needed.
