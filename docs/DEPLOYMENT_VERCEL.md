# Vercel Deployment

Set the repository Root Directory to `frontend`.

Configure these Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` only for server routes that require privileged access
- `NEXT_PUBLIC_API_BASE_URL` for any compatibility call that still targets FastAPI
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REDIRECT_URI`

Build command: `npm run build`.
Install command: `npm ci`.

Do not set `NEXT_PUBLIC_*` to service-role credentials. Do not add Nginx or a permanent FastAPI server to Vercel. Large uploads should use Supabase Storage directly; TikTok video uploads should remain bounded and should not be submitted through oversized serverless bodies.
