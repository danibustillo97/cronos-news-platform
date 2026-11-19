# Migration Status

## Implemented

- Supabase-only persistence adapters exist for news, stories, discovery, artifacts, assets, settings, studio projects and publications.
- Existing SQL Server dependencies were not found in tracked application code or dependencies.
- FastAPI scheduled publication loop removed.
- Scheduled publication has a CLI worker and GitHub Actions workflow.
- Supabase configuration moved away from hardcoded project credentials in the audited frontend and backend clients.
- Existing migration SQL is retained as historical setup/patch material only. It must not be applied as part of this transformation unless explicitly authorized.

## Implemented partially

- Discovery and processing jobs exist in Supabase, but not every queue type has a full Actions claim/retry worker.
- Some backend adapters still point to a local Runtime or local LAB process.
- TikTok, TTS and large media operations need serverless limits and external configuration validation.
- Social Media Studio persistence exists, but end-to-end external deployment requires Supabase credentials and live RLS verification.

## Pending external configuration

- Do not apply migration files. No new schema changes are authorized.
- Configure RLS and Storage policies.
- Configure Vercel environment variables.
- Add GitHub Actions secrets.
- Rotate any credentials previously committed in repository history.
- Configure TikTok OAuth values.

## Blocked

- Live Supabase RLS, Storage and external publishing validation cannot pass without project credentials.
