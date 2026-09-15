-- ASSET / MEDIA GENERATION -- Phase 7. Run in Supabase SQL Editor. Safe to
-- re-run (IF NOT EXISTS / ON CONFLICT). See backend/app/domain/asset/
-- entities.py for the domain model this backs.

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  story_id text not null,
  composition_id uuid references compositions(id) on delete set null,
  type text not null check (type in ('IMAGE', 'VIDEO', 'AUDIO', 'VOICE', 'SUBTITLE', 'LOGO', 'GRAPHIC', 'FONT')),
  provenance text,
  -- opaque reference resolved by StoragePort -- "<story_id>/<relative_path>"
  -- for today's local-filesystem adapter, never a raw path exposed to the frontend
  storage_ref text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists assets_story_id_idx on assets(story_id);

create table if not exists media_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id) on delete cascade,
  placeholder_id text not null,
  status text not null default 'QUEUED'
    check (status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  asset_id uuid references assets(id) on delete set null,
  error text
);
create index if not exists media_generation_jobs_artifact_id_idx on media_generation_jobs(artifact_id);

alter table assets enable row level security;
alter table media_generation_jobs enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['assets', 'media_generation_jobs']
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
