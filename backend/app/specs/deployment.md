# Deployment Guide — 100% Free Infrastructure

## Architecture

| Component | Service | Plan |
|-----------|---------|------|
| Frontend | Vercel | Free (Hobby) |
| Backend | Render | Free (750h/month) |
| Database | Neon | Free (0.5GB, 1 project) |
| AI | Gemini API | Free (15 RPM) |

## Step 1: Database — Neon (PostgreSQL)

1. Go to https://neon.tech → Sign up free
2. Create project → get connection string
3. Update `.env`:
```
DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx.region.neon.tech/dbname?sslmode=require
```
4. Add `asyncpg` to requirements.txt (replace `aiosqlite`):
```
asyncpg==0.30.0
```
5. Database auto-creates tables on first startup via `init_db()`

## Step 2: Backend — Render

1. Push backend to GitHub
2. Go to https://render.com → New Web Service
3. Settings:
   - Runtime: Python
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Plan: Free
4. Add env vars:
   - `GEMINI_API_KEY` = your key
   - `DATABASE_URL` = Neon connection string
   - `JWT_SECRET` = long random string
   - `FRONTEND_URL` = your Vercel domain

## Step 3: Frontend — Vercel

1. Push frontend to GitHub
2. Go to https://vercel.com → Import project
3. Framework: Next.js (auto-detected)
4. Add env var:
   - `NEXT_PUBLIC_API_URL` = https://your-backend.onrender.com/api
5. Deploy

## Step 4: CORS

Backend config.py already reads `FRONTEND_URL` from env. Set it to your Vercel domain:
```
FRONTEND_URL=https://your-app.vercel.app
```

The CORS middleware allows both `FRONTEND_URL` and `localhost:3000`.

## Step 5: SQLite → PostgreSQL Migration

Only config change needed. Same SQLAlchemy models work with both.

1. Install asyncpg: `pip install asyncpg`
2. Change `DATABASE_URL` from `sqlite+aiosqlite:///./job_hunter.db` to Neon URL
3. Tables auto-create on startup

No data migration needed for fresh deployment.

## Free Tier Limits

| Service | Limit |
|---------|-------|
| Vercel | 100GB bandwidth/month |
| Render | 750h/month (sleeps after 15min idle) |
| Neon | 0.5GB storage, 1 project |
| Gemini | 15 RPM, 1M tokens/min, 1500 req/day |
