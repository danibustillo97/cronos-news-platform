# Vercel Deployment

Set the repository Root Directory to `frontend`.

Configure these Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` only for server routes that require privileged access
- `BACKEND_PUBLIC_URL`: URL of the FastAPI backend Vercel project (see `docs/DEPLOYMENT_BACKEND_VERCEL.md`). Leave `NEXT_PUBLIC_API_BASE_URL` unset so the browser goes through the `/api/*` proxy.
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`

Build command: `npm run build`.
Install command: `npm ci`.

Do not set `NEXT_PUBLIC_*` to service-role credentials. Do not add Nginx or a permanent FastAPI server to Vercel; FastAPI runs as a separate serverless Vercel project (`docs/DEPLOYMENT_BACKEND_VERCEL.md`). Large uploads should use Supabase Storage directly; TikTok video uploads should remain bounded and should not be submitted through oversized serverless bodies.
