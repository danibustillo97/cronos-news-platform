-- ARTIFACT -- NEXUS's editorial intelligence engine output. Run in
-- Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- See backend/app/domain/artifact/entities.py for the domain model this
-- backs.

create table if not exists artifacts (
  id uuid primary key default gen_random_uuid(),
  story_id text not null references cronos_stories(id) on delete cascade,
  version int not null default 1,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'REVIEW_REQUIRED', 'VALIDATED', 'APPROVED', 'REJECTED', 'PUBLISHED')),
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
  -- [{check, detail}] -- the real ValidationResult.issues, empty when VALIDATED
  validation_issues jsonb not null default '[]',
  editorial_notes text,
  created_at timestamptz not null default now(),
  -- real id of the row this produced in the pre-existing public `news`
  -- table once PUBLISHED -- null until then, never a placeholder value
  published_news_id text
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
  error text
);
create index if not exists artifact_jobs_created_at_idx on artifact_jobs(created_at desc);

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
