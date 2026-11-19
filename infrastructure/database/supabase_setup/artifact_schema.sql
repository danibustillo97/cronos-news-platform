-- ARTIFACT -- NEXUS's editorial intelligence engine output. Run in
-- Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- See backend/app/domain/artifact/entities.py for the domain model this
-- backs.

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  story_id text not null references cronos_stories(id) on delete cascade,
  version int not null default 1,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'REVIEW_REQUIRED', 'VALIDATED', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED', 'PUBLISHING')),
  title text not null,
  subtitle text,
  excerpt text not null,
  summary text not null,
  content_html text not null,
  category_id uuid references categories(id) on delete set null,
  tags text[] not null default '{}',
  entities text[] not null default '{}',
  -- {seo_title, seo_description, slug, canonical_url}
  seo jsonb not null default '{}',
  -- [{source_url, source_name, source_domain, author, published_at, retrieved_at, license_info}]
  sources jsonb not null default '[]',
  -- [{text, label, source_urls}] -- label in SOURCE_FACT/VERIFIED_CONTEXT/INFERENCE/CREATIVE_FRAMING/UNVERIFIED
  claims jsonb not null default '[]',
  -- [{placeholder_id, kind, prompt, asset_id}]
  media_requirements jsonb not null default '[]',
  -- [{check, detail, severity}] -- the real ValidationResult.issues (severity:
  -- BLOCKING|WARNING, section 7) -- empty (or WARNING-only) when VALIDATED
  validation_issues jsonb not null default '[]',
  editorial_notes text,
  created_at timestamptz not null default now(),
  -- real id of the row this produced in the pre-existing public `news`
  -- table once PUBLISHED -- null until then, never a placeholder value
  published_news_id text,
  scheduled_at timestamptz,
  publishing_started_at timestamptz
);
create index if not exists artifacts_story_id_idx on artifacts(story_id);
create index if not exists artifacts_status_idx on artifacts(status);

create table if not exists artifact_jobs (
  id uuid primary key default gen_random_uuid(),
  story_id text not null references cronos_stories(id) on delete cascade,
  status text not null default 'QUEUED'
    check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'REVIEW_REQUIRED')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  artifact_id uuid references artifacts(id) on delete set null,
  error text,
  -- Provider Control Plane -- resolved once at trigger time, persisted
  -- as real provenance, never re-resolved. NULL only for jobs created
  -- before this column existed.
  provider text,
  model text,
  -- Section 1's real per-attempt validation snapshot (retry history) --
  -- null for jobs that never reached a real Artifact (still QUEUED/
  -- RUNNING, or FAILED before generation produced anything to validate).
  validation_ok boolean,
  validation_issue_count int
);
create index if not exists artifact_jobs_created_at_idx on artifact_jobs(created_at desc);
create index if not exists artifact_jobs_story_id_idx on artifact_jobs(story_id);

-- Idempotent: adds columns to an already-created artifact_jobs table
-- (this project's live table predates the Provider Control Plane and,
-- later, the validation snapshot).
alter table artifact_jobs add column if not exists provider text;
alter table artifact_jobs add column if not exists model text;
alter table artifact_jobs add column if not exists validation_ok boolean;
alter table artifact_jobs add column if not exists validation_issue_count int;

-- Idempotent: widens an already-created artifacts.status check to allow
-- ARCHIVED (section 2's real "Eliminar") without dropping/recreating the
-- table. Postgres auto-names an inline column CHECK as
-- "<table>_<column>_check" when the table was created without an
-- explicit constraint name -- exactly how this one was declared above.
alter table artifacts drop constraint if exists artifacts_status_check;
alter table artifacts add constraint artifacts_status_check
  check (status in ('DRAFT', 'REVIEW_REQUIRED', 'VALIDATED', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED', 'PUBLISHING'));

alter table artifacts add column if not exists scheduled_at timestamptz;
alter table artifacts add column if not exists publishing_started_at timestamptz;

-- Stable publication identity makes retries safe after a worker restart.
alter table news add column if not exists artifact_id uuid references artifacts(id) on delete set null;
create unique index if not exists news_artifact_id_key
  on news(artifact_id) where artifact_id is not null;

alter table artifacts enable row level security;
alter table artifact_jobs enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['artifacts', 'artifact_jobs']
  loop
    execute format('drop policy if exists "read_all" on %I', t);
    execute format('create policy "read_all" on %I for select using (true)', t);
    execute format('drop policy if exists "write_authenticated" on %I', t);
    execute format(
      'create policy "write_authenticated" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t
    );
  end loop;
end $$;
