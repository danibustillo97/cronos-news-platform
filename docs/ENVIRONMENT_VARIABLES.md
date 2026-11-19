# Environment Variables

## Vercel / frontend

- `NEXT_PUBLIC_SUPABASE_URL`: public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public anon key; protected by RLS.
- `SUPABASE_URL`: server-side Supabase URL.
- `SUPABASE_ANON_KEY`: optional server-side anon fallback.
- `SUPABASE_SERVICE_ROLE_KEY`: privileged server/worker key; never `NEXT_PUBLIC_*`.
- `SUPABASE_ANON_KEY`: anon key used by server-side session validation.
- `ADMIN_USER_IDS`: comma-separated Supabase user UUIDs with administrative access.
- `ADMIN_EMAILS`: comma-separated administrator emails as a secondary allowlist.
- `OAUTH_STATE_SECRET`: random server secret of at least 32 characters for signed OAuth state cookies.
- `OAUTH_TOKEN_ENCRYPTION_KEY`: base64 encoding of exactly 32 bytes for AES-256-GCM TikTok token encryption.
- `IMAGE_PROXY_ALLOWED_HOSTS`: optional comma-separated image host allowlist.
- `NEXT_PUBLIC_API_BASE_URL`: optional FastAPI compatibility URL.
- `BACKEND_PUBLIC_URL`: server-only URL used by the Next.js FastAPI compatibility proxy.
- `TIKTOK_*`: TikTok OAuth server credentials.
- `ADS_TXT_LINES`: server-only or public newline-separated official ads.txt records.
- `NEXT_PUBLIC_ADSENSE_ENABLED`: enable AdSense after consent.
- `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID`: official AdSense publisher ID.
- `NEXT_PUBLIC_ADSENSE_SLOT_*`: official AdSense slots by position.
- `NEXT_PUBLIC_ADSTERRA_ENABLED`: enable Adsterra after consent.
- `NEXT_PUBLIC_ADSTERRA_SCRIPT_URL`: official Adsterra script URL.
- `NEXT_PUBLIC_ADSTERRA_CONTAINER_ID`: official Adsterra container ID.
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`: optional GA4 measurement ID.

## Backend

- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RUNTIME_BASE_URL`
- `LAB_WORKSPACE_PATH`
- `CORS_ALLOWED_ORIGINS`
- Provider credentials in `backend/.env` or the Settings providers interface.

## GitHub Actions

Store `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as repository or environment secrets. Do not print secret values in logs.
