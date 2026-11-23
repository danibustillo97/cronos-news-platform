# GitHub Actions

GitHub Actions is CRONOS' worker tier: everything that takes longer than a web request runs
here and stores its result in Supabase. The backend (Vercel) wakes the right workflow with
`workflow_dispatch` the moment a job is queued (`GITHUB_DISPATCH_TOKEN`, see
`DEPLOYMENT_VERCEL.md`); the cron schedule is the safety net. No workflow persists business
state in GitHub Actions.

| Workflow | Runs | Cron | Woken by |
| --- | --- | --- | --- |
| `discovery-processing.yml` | `automation/run_discovery_jobs.py`: queued "Buscar noticias" jobs over `SCRAPER_SOURCES`; honours "Detener" between feeds | every 30 min | "Buscar noticias" |
| `scraper.yml` | `automation/scraper.py`: periodic RSS/Atom ingestion into `discovery_items` (never publishes) | every 30 min | -- |
| `artifact-processing.yml` | `automation/run_artifact_jobs.py`: AI drafts for stories sent to editorial | every 10 min | "Procesar en Artifact", "Reintentar" |
| `media-processing.yml` | `automation/run_media_generation_jobs.py`: images via Cloudflare Workers AI, stored in Supabase Storage | every 15 min | "Generar imagen" |
| `scheduled-publications.yml` | `automation/run_scheduled_publications.py`: publishes artifacts whose time has come | every 15 min | -- |
| `ci.yml` | frontend typecheck/tests/lint and backend tests | pushes to `master`, pull requests | -- |

Every worker has a `concurrency` group: a dispatch that arrives while a run is active waits
instead of processing the same job twice.

## Secrets and variables

Repository **secrets**:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` -- every worker
- `SCRAPER_SOURCES` -- comma-separated RSS/Atom feed URLs (discovery, scraper)
- `ANTHROPIC_API_KEY` -- artifact processing
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` -- media processing (Workers AI, model
  `@cf/black-forest-labs/flux-1-schnell`)

Repository **variable** (optional): `ARTIFACT_PROVIDER` (default `anthropic`).

The workflows set `JOB_EXECUTION=github` and `ASSET_STORAGE=supabase` themselves;
`RUNTIME_BASE_URL` is no longer needed.

GitHub-hosted runners must not be assumed to support heavyweight FFmpeg or GPU rendering;
LAB video productions stay on a local machine.
