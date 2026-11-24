-- ============================================================================
-- 2026-11-24 · Portada del portal (pestaña "Portada" del editor)
-- Una sola fila (id='global'): qué ocupa el escenario de la portada (noticia,
-- video en vivo o radio), qué noticias van fijadas y en qué orden, y cuáles se
-- ocultan. El portal la lee por GET /api/portal/layout (backend). Si la tabla
-- no existe, el portal usa su comportamiento por defecto (la más reciente).
-- Idempotente. Ejecutar en Supabase -> SQL Editor.
-- ============================================================================
begin;

create table if not exists public.portal_layout (
  id text primary key default 'global' check (id = 'global'),
  stage_mode text not null default 'news' check (stage_mode in ('news', 'video', 'radio')),
  video_url text,
  video_title text,
  video_poster text,
  radio_url text,
  radio_title text,
  radio_logo text,
  pinned text[] not null default '{}',
  hidden text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.portal_layout (id) values ('global') on conflict (id) do nothing;

-- Solo el backend (secret key) lee y escribe; el portal pasa por la API.
alter table public.portal_layout enable row level security;

commit;
