-- DISCOVERY -- raw editorial candidates, before any editorial decision.
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- See backend/app/domain/discovery/entities.py for the domain model this
-- backs, and docs/NEXUS_ARCHITECTURE_BASELINE.md for why this is a new
-- bounded context rather than an extension of `news`.

create table if not exists discovery_items (
  -- Natural key from LAB's own ingestion (e.g. "df7b48a34390"), never a
  -- generated uuid -- discovery_repository.py always saves str(item.id),
  -- which wraps the id LAB's workspace item already has. A fresh install
  -- must create this as text from the start; the DO block below migrates
  -- an existing uuid-typed column (real bug found and fixed 2026-09-16).
  id text primary key,
  source_url text not null,
  original_url text not null,
  original_title text not null,
  raw_text text not null,
  source_name text,
  source_domain text not null,
  author text,
  language text,
  category_id uuid references categories(id) on delete set null,
  topics text[] not null default '{}',
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  -- list of {kind, url, usable_as_final_asset, editorial_prompt} --
  -- see MaterialReference in entities.py.
  materials jsonb not null default '[]',
  -- {freshness_score, relevance_score, impact_score, source_quality_score,
  --  completeness_score, material_score, duplicate_of} -- any field can be
  -- null/absent, see DiscoveryScores's own docstring for which are real
  -- today vs. always-null placeholders.
  scores jsonb not null default '{}',
  status text not null default 'DISCOVERED'
    check (status in ('DISCOVERED', 'SELECTED', 'IGNORED', 'ARCHIVED', 'SENT_TO_EDITORIAL')),
  story_id text references cronos_stories(id) on delete set null,
  assigned_to text,
  created_at timestamptz not null default now()
);
alter table discovery_items add column if not exists assigned_to text;
-- Migrates an already-created discovery_items.id from uuid to text (real
-- bug: LAB's natural keys like "df7b48a34390" are not uuids, so every
-- real ingestion failed with "invalid input syntax for type uuid").
-- Safe/idempotent: only runs when the column still IS uuid, and only
-- ever touches the column definition -- never drops the table or rows.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'discovery_items'
      and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table discovery_items alter column id drop default;
    alter table discovery_items alter column id type text using id::text;
  end if;
end $$;

create index if not exists discovery_items_status_idx on discovery_items(status);
create index if not exists discovery_items_discovered_at_idx on discovery_items(discovered_at desc);
create index if not exists discovery_items_category_id_idx on discovery_items(category_id);
-- Exact-match dedupe at the DB level too (LAB's own dedupe index is
-- process-local; this is the real cross-process guarantee).
create unique index if not exists discovery_items_source_url_key on discovery_items(source_url);

create table if not exists discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'QUEUED'
    check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLING', 'CANCELLED')),
  params jsonb not null default '{}',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  items_found int,
  error text
);
create index if not exists discovery_jobs_created_at_idx on discovery_jobs(created_at desc);

-- Widens an already-created discovery_jobs.status check constraint to
-- allow CANCELLING/CANCELLED (real graceful-stop feature) -- idempotent,
-- only drops/recreates the CHECK, never touches rows.
alter table discovery_jobs drop constraint if exists discovery_jobs_status_check;
alter table discovery_jobs add constraint discovery_jobs_status_check
  check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLING', 'CANCELLED'));

alter table discovery_items enable row level security;
alter table discovery_jobs enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['discovery_items', 'discovery_jobs']
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
