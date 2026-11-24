-- ============================================================================
-- 2026-11-24 (b) · Biblioteca de la estación de radio (auto DJ)
-- Pistas libres de derechos subidas al bucket público `media` (radio/...).
-- kind: song | jingle | station_id | promo | bed
-- energy 1..5 guía al auto DJ según la franja horaria.
-- Idempotente. Ejecutar en Supabase -> SQL Editor.
-- ============================================================================
begin;

create table if not exists public.radio_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default '',
  kind text not null default 'song' check (kind in ('song', 'jingle', 'station_id', 'promo', 'bed')),
  url text not null,
  storage_path text,
  duration_s numeric,
  energy smallint not null default 3 check (energy between 1 and 5),
  mood text,
  tags text[] not null default '{}',
  license text not null default '',
  active boolean not null default true,
  play_count integer not null default 0,
  last_played_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists radio_tracks_kind_active_idx on public.radio_tracks (kind) where active;

-- Solo el backend (secret key). Los archivos son públicos en Storage para poder sonar.
alter table public.radio_tracks enable row level security;

commit;
