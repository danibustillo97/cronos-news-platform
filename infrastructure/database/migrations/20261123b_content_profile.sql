-- ============================================================================
-- 2026-11-23 (b) · Perfil de contenido (setup inicial: modo Fútbol / Todo)
-- Una sola fila (id='global'). Si la tabla no existe, el backend usa el perfil
-- por defecto (Fútbol, todas las competiciones) y el setup no se puede guardar.
-- Idempotente. Ejecutar en Supabase -> SQL Editor.
-- ============================================================================
begin;

create table if not exists public.content_profile (
  id text primary key default 'global' check (id = 'global'),
  mode text not null default 'football' check (mode in ('football', 'all')),
  setup_completed boolean not null default false,
  competitions text[] not null default '{}',
  focuses text[] not null default '{}',
  disabled_sources text[] not null default '{}',
  custom_sources jsonb not null default '[]',
  priority_terms text[] not null default '{}',
  blocked_terms text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Solo backend/workers (service_role). Sin políticas = nadie más la ve.
alter table public.content_profile enable row level security;

commit;
