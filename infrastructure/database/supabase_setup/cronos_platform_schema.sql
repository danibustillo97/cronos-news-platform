-- CRONOS PLATFORM SCHEMA
-- ⚠️ Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
--
-- This is the operational source of truth for the CRONOS content platform
-- (Story / Production / Composition / Distribution). It does NOT touch or
-- replace the existing `news` table (the Editorial Desk keeps owning that).
-- Business concepts are persisted, not "a JSON copy of every LAB file" —
-- see src/server/domain for the entities these tables back.
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / ON CONFLICT).

-- ============================================================
-- CATEGORIES
-- ============================================================

create table if not exists category_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  active boolean not null default true
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references category_groups(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (group_id, slug)
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  slug text not null,
  unique (category_id, slug)
);

-- ============================================================
-- STORY (the center of the platform — rule #5)
-- ============================================================

create table if not exists cronos_stories (
  id text primary key, -- reuses LAB's real story_id (e.g. 793ff158b714) as the natural key
  headline text not null,
  summary text,
  status text not null default 'DISCOVERED'
    check (status in ('DISCOVERED', 'IN_PRODUCTION', 'PRODUCED', 'PUBLISHED')),
  category_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- source_news_id is a loose reference (no FK) into the pre-existing `news`
-- table on purpose — we don't assume its id column type/constraints here.
create table if not exists story_sources (
  id uuid primary key default gen_random_uuid(),
  story_id text not null references cronos_stories(id) on delete cascade,
  source_news_id text,
  source_url text,
  label text not null default 'news'
);
create index if not exists story_sources_story_id_idx on story_sources(story_id);

-- One row per intelligence artifact kind LAB produced for a story
-- (editorial, concepts, narrative, audio, media_blueprint, research, ...).
-- JSONB because each kind's shape is genuinely variable — rule #4.
create table if not exists story_intelligence (
  id uuid primary key default gen_random_uuid(),
  story_id text not null references cronos_stories(id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (story_id, kind)
);
create index if not exists story_intelligence_story_id_idx on story_intelligence(story_id);

-- ============================================================
-- PRODUCTION
-- ============================================================

create table if not exists productions (
  id uuid primary key default gen_random_uuid(),
  story_id text not null references cronos_stories(id) on delete cascade,
  status text not null check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  stages jsonb not null default '[]',
  errors text[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Identidad real del LAB workspace item que esta Production ejecuta --
  -- distinta de story_id a propósito (ver app/domain/production/entities.py).
  -- Nullable: filas viejas sin esta columna hacen fallback a story_id.
  lab_item_id text
);
create index if not exists productions_story_id_idx on productions(story_id);

-- La tabla ya existía antes de agregar lab_item_id -- create table if not
-- exists no la retrocompleta, así que hace falta el ALTER explícito
-- (idempotente, no destructivo).
alter table productions add column if not exists lab_item_id text;

-- ============================================================
-- COMPOSITION (rule #13)
-- ============================================================

create table if not exists compositions (
  id uuid primary key default gen_random_uuid(),
  story_id text not null references cronos_stories(id) on delete cascade,
  production_id uuid not null references productions(id) on delete cascade,
  kind text not null,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'REJECTED')),
  content jsonb not null default '{}',
  target_platforms text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists compositions_story_id_idx on compositions(story_id);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  story_id text not null references cronos_stories(id) on delete cascade,
  composition_id uuid references compositions(id) on delete set null,
  type text not null,
  provenance text,
  storage_path text not null, -- backend-served path or Supabase Storage key — never a raw local filesystem path
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists assets_story_id_idx on assets(story_id);

-- ============================================================
-- DISTRIBUTION (rule #16)
-- ============================================================

create table if not exists distribution_plans (
  id uuid primary key default gen_random_uuid(),
  composition_id uuid not null references compositions(id) on delete cascade,
  platform text not null check (platform in ('WEB', 'TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE')),
  format text not null check (format in ('ARTICLE', 'POST', 'REEL', 'STORY', 'SHORT', 'CAROUSEL', 'LONG_FORM', 'VIDEO')),
  status text not null check (status in ('NOT_CONNECTED', 'READY', 'PENDING', 'PUBLISHED', 'FAILED')),
  copy text,
  publication_url text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (composition_id, platform)
);
create index if not exists distribution_plans_composition_id_idx on distribution_plans(composition_id);

create table if not exists publication_records (
  id uuid primary key default gen_random_uuid(),
  distribution_plan_id uuid not null references distribution_plans(id) on delete cascade,
  published_at timestamptz not null default now(),
  external_id text,
  external_url text,
  raw_response jsonb
);

-- ============================================================
-- RUNTIME (the bridge to the LAB Local Runtime — see
-- RPA_NEWS_SCRIPT/runtime/. The LAB workspace filesystem stays LAB's
-- execution scratch space; these two tables are the only operational
-- state the bridge needs in Supabase — everything else LAB produces
-- lands in story_intelligence/compositions/assets like any other
-- artifact, never in a bespoke table.)
-- ============================================================

create table if not exists runtime_registrations (
  id text primary key default 'local', -- one local runtime for now
  status text not null check (status in ('CONNECTED', 'DISCONNECTED')),
  capabilities jsonb not null default '[]',
  last_heartbeat_at timestamptz not null default now()
);

create table if not exists production_jobs (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references productions(id) on delete cascade,
  stage text not null,
  status text not null check (status in ('QUEUED', 'RUNNING', 'DONE', 'FAILED')),
  lab_job_id text,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists production_jobs_production_id_idx on production_jobs(production_id);

-- ============================================================
-- SITE SETTINGS — singleton row (id='global'). Backs the "Global SEO
-- Config" panel in /admin (AdminSeoTags.tsx) and frontend/src/app/
-- layout.tsx's generateMetadata(); replaces both the hardcoded
-- defaultValue props that admin form used to save nowhere and the
-- build-time-frozen `export const metadata` layout.tsx used to have.
-- ============================================================

create table if not exists site_settings (
  id text primary key default 'global',
  site_title text not null,
  meta_description text not null,
  keywords text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RLS — reads open (operational dashboards are behind Supabase Auth on the
-- admin routes already), writes restricted to authenticated sessions.
-- ============================================================

alter table category_groups enable row level security;
alter table categories enable row level security;
alter table topics enable row level security;
alter table cronos_stories enable row level security;
alter table story_sources enable row level security;
alter table story_intelligence enable row level security;
alter table productions enable row level security;
alter table compositions enable row level security;
alter table assets enable row level security;
alter table distribution_plans enable row level security;
alter table publication_records enable row level security;
alter table runtime_registrations enable row level security;
alter table production_jobs enable row level security;
alter table site_settings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'category_groups','categories','topics','cronos_stories','story_sources',
    'story_intelligence','productions','compositions','assets',
    'distribution_plans','publication_records',
    'runtime_registrations','production_jobs','site_settings'
  ]
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

-- ============================================================
-- SEED — real category tree (replaces the hardcoded GLOBAL_CATEGORIES
-- object that used to live in src/lib/globalCategories.ts).
-- ============================================================

insert into category_groups (name, slug, sort_order) values
  ('Deportes', 'deportes', 1),
  ('Tecnología', 'tecnologia', 2),
  ('Mundo', 'mundo', 3),
  ('Entretenimiento', 'entretenimiento', 4),
  ('Negocios', 'negocios', 5),
  ('Estilo de Vida', 'estilo-de-vida', 6),
  ('Opinión', 'opinion', 7)
on conflict (slug) do nothing;

insert into categories (group_id, name, slug, sort_order)
select g.id, c.name, c.slug, c.sort_order from category_groups g
join (values
  ('deportes', 'Fútbol', 'futbol', 1), ('deportes', 'Baloncesto', 'baloncesto', 2),
  ('deportes', 'Tenis', 'tenis', 3), ('deportes', 'Motor', 'motor', 4),
  ('deportes', 'UFC/MMA', 'ufc-mma', 5), ('deportes', 'Béisbol', 'beisbol', 6),
  ('deportes', 'Fútbol Americano', 'futbol-americano', 7), ('deportes', 'Ciclismo', 'ciclismo', 8),
  ('deportes', 'Atletismo', 'atletismo', 9), ('deportes', 'Esports', 'esports', 10),
  ('deportes', 'Golf', 'golf', 11), ('deportes', 'Natación', 'natacion', 12),
  ('deportes', 'Voleibol', 'voleibol', 13), ('deportes', 'Boxeo', 'boxeo', 14),
  ('tecnologia', 'Inteligencia Artificial', 'inteligencia-artificial', 1),
  ('tecnologia', 'Gadgets', 'gadgets', 2), ('tecnologia', 'Móviles', 'moviles', 3),
  ('tecnologia', 'Software', 'software', 4), ('tecnologia', 'Ciberseguridad', 'ciberseguridad', 5),
  ('tecnologia', 'Blockchain/Cripto', 'blockchain-cripto', 6), ('tecnologia', 'Startups', 'startups', 7),
  ('tecnologia', 'Redes Sociales', 'redes-sociales', 8), ('tecnologia', 'Realidad Virtual', 'realidad-virtual', 9),
  ('tecnologia', 'Espacio', 'espacio', 10),
  ('mundo', 'Política', 'politica', 1), ('mundo', 'Conflictos', 'conflictos', 2),
  ('mundo', 'Economía Global', 'economia-global', 3), ('mundo', 'Medio Ambiente', 'medio-ambiente', 4),
  ('mundo', 'Sociedad', 'sociedad', 5), ('mundo', 'Educación', 'educacion', 6),
  ('mundo', 'Salud', 'salud', 7), ('mundo', 'Ciencia', 'ciencia', 8),
  ('entretenimiento', 'Cine', 'cine', 1), ('entretenimiento', 'Series/TV', 'series-tv', 2),
  ('entretenimiento', 'Música', 'musica', 3), ('entretenimiento', 'Celebridades', 'celebridades', 4),
  ('entretenimiento', 'Videojuegos', 'videojuegos', 5), ('entretenimiento', 'Arte', 'arte', 6),
  ('entretenimiento', 'Libros', 'libros', 7), ('entretenimiento', 'Cultura Pop', 'cultura-pop', 8),
  ('negocios', 'Mercados', 'mercados', 1), ('negocios', 'Finanzas Personales', 'finanzas-personales', 2),
  ('negocios', 'Emprendimiento', 'emprendimiento', 3), ('negocios', 'Empresas', 'empresas', 4),
  ('negocios', 'Inmobiliario', 'inmobiliario', 5), ('negocios', 'Marketing', 'marketing', 6),
  ('negocios', 'E-commerce', 'e-commerce', 7),
  ('estilo-de-vida', 'Viajes', 'viajes', 1), ('estilo-de-vida', 'Gastronomía', 'gastronomia', 2),
  ('estilo-de-vida', 'Moda', 'moda', 3), ('estilo-de-vida', 'Fitness', 'fitness', 4),
  ('estilo-de-vida', 'Bienestar', 'bienestar', 5), ('estilo-de-vida', 'Hogar', 'hogar', 6),
  ('estilo-de-vida', 'Automóviles (Lifestyle)', 'automoviles-lifestyle', 7),
  ('opinion', 'Editoriales', 'editoriales', 1), ('opinion', 'Columnas', 'columnas', 2),
  ('opinion', 'Análisis', 'analisis', 3), ('opinion', 'Entrevistas', 'entrevistas', 4),
  ('opinion', 'Reportajes', 'reportajes', 5)
) as c(group_slug, name, slug, sort_order) on c.group_slug = g.slug
on conflict (group_id, slug) do nothing;

insert into topics (category_id, name, slug)
select c.id, t.name, t.slug from categories c
join (values
  ('futbol', 'La Liga', 'la-liga'), ('futbol', 'Premier League', 'premier-league'),
  ('futbol', 'Champions League', 'champions-league'), ('futbol', 'Serie A', 'serie-a'),
  ('futbol', 'Bundesliga', 'bundesliga'), ('futbol', 'Ligue 1', 'ligue-1'),
  ('futbol', 'Copa del Mundo', 'copa-del-mundo'), ('futbol', 'Libertadores', 'libertadores'),
  ('futbol', 'Fichajes', 'fichajes'),
  ('baloncesto', 'NBA', 'nba'), ('baloncesto', 'Euroliga', 'euroliga'),
  ('baloncesto', 'ACB', 'acb'), ('baloncesto', 'Playoffs', 'playoffs'), ('baloncesto', 'WNBA', 'wnba'),
  ('tenis', 'ATP', 'atp'), ('tenis', 'WTA', 'wta'), ('tenis', 'Grand Slam', 'grand-slam'),
  ('tenis', 'Wimbledon', 'wimbledon'), ('tenis', 'Roland Garros', 'roland-garros'),
  ('tenis', 'US Open', 'us-open'), ('tenis', 'Australian Open', 'australian-open'),
  ('motor', 'Fórmula 1', 'formula-1'), ('motor', 'MotoGP', 'motogp'),
  ('motor', 'Rally', 'rally'), ('motor', 'Dakar', 'dakar'), ('motor', 'IndyCar', 'indycar'),
  ('ufc-mma', 'UFC', 'ufc'), ('ufc-mma', 'Bellator', 'bellator'), ('ufc-mma', 'PFL', 'pfl'),
  ('inteligencia-artificial', 'ChatGPT', 'chatgpt'), ('inteligencia-artificial', 'Gemini', 'gemini'),
  ('inteligencia-artificial', 'OpenAI', 'openai'), ('inteligencia-artificial', 'Machine Learning', 'machine-learning'),
  ('inteligencia-artificial', 'Robótica', 'robotica'), ('inteligencia-artificial', 'Ética IA', 'etica-ia'),
  ('moviles', 'iPhone', 'iphone'), ('moviles', 'Samsung', 'samsung'), ('moviles', 'Android', 'android'),
  ('blockchain-cripto', 'Bitcoin', 'bitcoin'), ('blockchain-cripto', 'Ethereum', 'ethereum'),
  ('blockchain-cripto', 'NFTs', 'nfts'), ('blockchain-cripto', 'DeFi', 'defi'), ('blockchain-cripto', 'Regulación', 'regulacion'),
  ('cine', 'Estrenos', 'estrenos'), ('cine', 'Hollywood', 'hollywood'), ('cine', 'Premios Oscar', 'premios-oscar'),
  ('cine', 'Netflix', 'netflix'), ('cine', 'Marvel', 'marvel'), ('cine', 'DC', 'dc'),
  ('videojuegos', 'PlayStation', 'playstation'), ('videojuegos', 'Xbox', 'xbox'),
  ('videojuegos', 'Nintendo', 'nintendo'), ('videojuegos', 'PC Gaming', 'pc-gaming'), ('videojuegos', 'Streamers', 'streamers'),
  ('politica', 'Elecciones', 'elecciones'), ('politica', 'Gobierno', 'gobierno'),
  ('politica', 'Leyes', 'leyes'), ('politica', 'Diplomacia', 'diplomacia'), ('politica', 'Crisis', 'crisis'),
  ('economia-global', 'Inflación', 'inflacion'), ('economia-global', 'Bolsa', 'bolsa'),
  ('economia-global', 'Dólar', 'dolar'), ('economia-global', 'Petróleo', 'petroleo')
) as t(category_slug, name, slug) on t.category_slug = c.slug
on conflict (category_id, slug) do nothing;

-- ============================================================
-- REALTIME — el frontend se suscribe a estos cambios en vez de
-- hacer polling (ver ProductionContext.tsx). RLS ya cubre esto
-- (read_all, using (true)) — Realtime respeta esa misma policy.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['productions', 'compositions', 'runtime_registrations']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then
      null; -- ya estaba agregada a la publicación, no hace falta repetir
    end;
  end loop;
end $$;

-- ============================================================
-- SEED — site_settings singleton, con los valores que hasta ahora estaban
-- hardcodeados en frontend/src/app/layout.tsx (export const metadata) --
-- no se inventa un valor nuevo, se persiste el que ya era real y visible
-- en el sitio.
-- ============================================================

insert into site_settings (id, site_title, meta_description, keywords) values (
  'global',
  'Nexus News | Noticias Deportivas al Instante',
  'El mejor portal de noticias deportivas con análisis IA en tiempo real. Cobertura de fútbol, NBA, F1 y más.',
  array['deportes', 'noticias', 'fútbol', 'NBA', 'F1', 'resultados en vivo']
)
on conflict (id) do nothing;
