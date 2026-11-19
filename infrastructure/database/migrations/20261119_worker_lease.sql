-- Worker lease metadata for existing job tables.
-- Non-destructive, idempotent, and scoped to SUPABASE_ONLY persistence.

alter table public.artifact_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists lease_until timestamptz,
  add column if not exists locked_by text,
  add column if not exists locked_at timestamptz;

alter table public.discovery_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists lease_until timestamptz,
  add column if not exists locked_by text,
  add column if not exists locked_at timestamptz;

alter table public.production_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists lease_until timestamptz,
  add column if not exists locked_by text,
  add column if not exists locked_at timestamptz;

alter table public.media_generation_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists lease_until timestamptz,
  add column if not exists locked_by text,
  add column if not exists locked_at timestamptz;

create index if not exists artifact_jobs_worker_claim_idx
  on public.artifact_jobs(status, lease_until, created_at);
create index if not exists discovery_jobs_worker_claim_idx
  on public.discovery_jobs(status, lease_until, created_at);
create index if not exists production_jobs_worker_claim_idx
  on public.production_jobs(status, lease_until, created_at);
create index if not exists media_generation_jobs_worker_claim_idx
  on public.media_generation_jobs(status, lease_until, created_at);
