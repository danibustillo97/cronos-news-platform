# Vercel Deployment

CRONOS runs on **Vercel + GitHub Actions + Supabase** only. There is no permanent
server, no Nginx and no local Automation runtime in production:

| Piece | Where | What it does |
| --- | --- | --- |
| Frontend (Next.js) | Vercel project, Root Directory `frontend` | Site, admin, `/api/*` proxy to the backend |
| Backend (FastAPI) | Vercel project, Root Directory `backend` | One Python function (`backend/api/index.py`) |
| Workers | GitHub Actions (`.github/workflows/*-processing.yml`, `scraper.yml`) | Scraping, AI drafting, image generation, scheduled publishing |
| Data, files, auth | Supabase | Postgres (RLS), Storage bucket `media`, Auth |

A queued job (Discovery search, AI draft, image) is picked up within seconds: the backend
wakes the matching workflow through `workflow_dispatch`. Each workflow also runs on a cron
schedule, so a job is never lost if the wake-up is not configured or fails.

## 1. Frontend project (`frontend`)

Build command `npm run build`, install command `npm ci`.

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public, protected by RLS |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | server-side session validation |
| `SUPABASE_SERVICE_ROLE_KEY` | only for server routes that need privileged access |
| `BACKEND_PUBLIC_URL` | URL of the backend Vercel project (server only) |
| `ADMIN_USER_IDS` / `ADMIN_EMAILS` | admin allowlists |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` | TikTok OAuth |
| `NEXT_PUBLIC_ICE_SERVERS` | optional TURN servers for broadcaster guests (JSON) |

**Leave `NEXT_PUBLIC_API_BASE_URL` unset.** The browser then calls `/api/...` on the same
origin and `app/api/[...path]/route.ts` forwards it to `BACKEND_PUBLIC_URL` with the session
cookie (kept fresh while the admin is open, see `lib/adminSession.ts`). Setting it makes the
browser call the backend cross-origin without that cookie.

Never put the service-role key in a `NEXT_PUBLIC_*` variable.

## 2. Backend project (`backend`)

Vercel detects `backend/api/index.py` and `backend/requirements.txt`; `backend/vercel.json`
routes every path to the function (`maxDuration` 60 s).

| Variable | Value |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Supabase project |
| `JOB_EXECUTION` | `github` -- jobs run on GitHub Actions, never inside a request |
| `ASSET_STORAGE` | `supabase` -- uploads and generated images go to Storage |
| `ASSET_STORAGE_BUCKET` | optional, default `media` (must be public) |
| `GITHUB_DISPATCH_TOKEN` | fine-grained token with access to this repository and permission **Actions: read and write** |
| `GITHUB_REPOSITORY` | `danibustillo97/cronos-news-platform` |
| `GITHUB_DISPATCH_REF` | branch whose workflows run, default `master` |
| `ANTHROPIC_API_KEY`, `ARTIFACT_PROVIDER` | AI provider for suggestions made from the editor |
| `ADMIN_USER_IDS` / `ADMIN_EMAILS` | same allowlists as the frontend |
| `CORS_ALLOWED_ORIGINS` | only if something calls the backend cross-origin |

Provider keys cannot be changed from the app in this mode (there is no writable `.env`):
the settings screen explains which variable to set in Vercel and GitHub.

## 3. Supabase

1. Apply the migrations in `infrastructure/database/migrations` (review
   `20261120_news_author_without_email.sql` first: it rewrites email bylines).
2. Bucket `media` must exist and be **public** (articles load images from its CDN URL).
3. `infrastructure/database/supabase_setup/football_broadcast_schema.sql` enables cloud sync
   of the broadcaster's match.

## 4. Limits to keep in mind

- A Vercel function accepts at most 4.5 MB per request. The editor compresses images in the
  browser before uploading (`lib/imageCompression.ts`); Noticias uploads go straight to
  Supabase Storage. TikTok video uploads must stay bounded for the same reason.
- The **Claude Code** provider and LAB video productions need a local machine with the CLI /
  FFmpeg; they are not available in this deployment. AI drafting uses Anthropic.
- Assets stored before `ASSET_STORAGE=supabase` keep their old local URLs; regenerate or
  re-upload them if they must appear on the public site.
