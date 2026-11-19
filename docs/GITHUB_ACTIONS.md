# GitHub Actions

## Scheduled Artifact Publications

Workflow: `.github/workflows/scheduled-publications.yml`

- Schedule: every 15 minutes.
- Trigger: cron or `workflow_dispatch`.
- Timeout: 10 minutes.
- Concurrency: one scheduled publication group.
- Required secrets:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

The workflow installs the backend dependencies and invokes `automation/run_scheduled_publications.py`. It does not persist business state in GitHub Actions.

GitHub-hosted runners must not be assumed to support heavyweight FFmpeg or GPU rendering. Those operations remain local/LAB until a dedicated runner and Storage contract are configured.

## Additional workflows

- `artifact-processing.yml`: processes existing `QUEUED` artifact jobs.
- `media-processing.yml`: processes existing `QUEUED` media generation jobs; heavyweight Runtime configuration may be required.
- `discovery-processing.yml`: processes queued discovery jobs directly with configured RSS/Atom sources.
- `scraper.yml`: ingests configured RSS/Atom candidates into `discovery_items` and never publishes them automatically.

Discovery, scraper and scheduled publication workflows do not require `RUNTIME_BASE_URL`.
