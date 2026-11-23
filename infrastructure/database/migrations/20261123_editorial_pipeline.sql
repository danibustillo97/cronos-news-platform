-- ============================================================================
-- 2026-11-23 · Editorial pipeline: schema sync + modo automático
--
-- Verificado contra la base real el 2026-11-23: estas columnas las escribe el
-- backend y NO existen en producción, por eso fallan hoy:
--   * discovery_items.assigned_to        -> todo guardado de un item falla
--                                            (scraper, seleccionar, enviar a editorial)
--   * artifacts.scheduled_at /
--     artifacts.publishing_started_at    -> programar/publicar programado falla
--   * news.artifact_id                   -> publicar un artículo falla
--
-- Idempotente: se puede ejecutar más de una vez sin efectos secundarios.
-- Ejecutar en Supabase -> SQL Editor. No toca datos existentes.
-- ============================================================================

begin;

-- 1. Discovery ---------------------------------------------------------------
alter table public.discovery_items add column if not exists assigned_to text;

-- 2. Artículos: programación de publicaciones --------------------------------
alter table public.artifacts drop constraint if exists artifacts_status_check;
alter table public.artifacts add constraint artifacts_status_check
  check (status in ('DRAFT', 'REVIEW_REQUIRED', 'VALIDATED', 'APPROVED', 'REJECTED',
                    'PUBLISHED', 'ARCHIVED', 'SCHEDULED', 'PUBLISHING'));
alter table public.artifacts add column if not exists scheduled_at timestamptz;
alter table public.artifacts add column if not exists publishing_started_at timestamptz;
create index if not exists artifacts_due_schedule_idx
  on public.artifacts (scheduled_at) where status = 'SCHEDULED';

-- 3. Publicación en el sitio (news.artifact_id) ------------------------------
-- El publicador hace upsert(on_conflict='artifact_id'). Postgres NO puede usar
-- un índice único PARCIAL (where artifact_id is not null) para ON CONFLICT sin
-- repetir el predicado, que PostgREST no envía -> el upsert fallaría igual.
-- Un índice único normal sirve: en Postgres los NULL no chocan entre sí, así
-- que las noticias antiguas sin artifact_id siguen permitidas.
alter table public.news add column if not exists artifact_id uuid
  references public.artifacts(id) on delete set null;
drop index if exists public.news_artifact_id_key;
create unique index news_artifact_id_key on public.news (artifact_id);

-- 4. Jobs: índices para los workers de GitHub Actions ------------------------
create index if not exists artifact_jobs_status_created_idx
  on public.artifact_jobs (status, created_at);
create index if not exists discovery_items_status_discovered_idx
  on public.discovery_items (status, discovered_at desc);

-- 5. Modo automático (piloto editorial) --------------------------------------
-- Una sola fila (id = 'global'). Apagado por defecto: el scraper trae noticias
-- y la redacción es manual. Encendido: el worker elige las mejores candidatas
-- y la IA (API de Anthropic) redacta borradores que quedan en Revisión.
create table if not exists public.editorial_automation (
  id text primary key default 'global' check (id = 'global'),
  enabled boolean not null default false,
  max_articles_per_run integer not null default 2 check (max_articles_per_run between 1 and 10),
  max_articles_per_day integer not null default 10 check (max_articles_per_day between 1 and 100),
  min_text_chars integer not null default 400 check (min_text_chars between 0 and 20000),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.editorial_automation (id) values ('global') on conflict (id) do nothing;

-- Solo el backend/workers (service_role, que ignora RLS) leen y escriben esta
-- tabla. Sin políticas para anon/authenticated = nadie más puede verla.
alter table public.editorial_automation enable row level security;

commit;

-- Verificación (debe devolver 4 filas):
-- select table_name, column_name from information_schema.columns
--  where (table_name, column_name) in (('discovery_items','assigned_to'),
--        ('artifacts','scheduled_at'), ('artifacts','publishing_started_at'), ('news','artifact_id'));
