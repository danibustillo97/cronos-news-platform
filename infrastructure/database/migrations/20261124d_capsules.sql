-- Cápsulas del feed tipo reels: efemérides, "¿Sabías que?", leyendas y momentos históricos.
-- Cada cápsula es una historia de 2-6 diapositivas (texto + imagen opcional),
-- pensada en vertical 9:16 para el portal y para TikTok.

create table if not exists public.capsules (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('efemeride', 'sabias_que', 'leyenda', 'momento')),
  title       text not null check (char_length(title) between 3 and 140),
  subject     text check (subject is null or char_length(subject) <= 120),   -- leyenda / equipo / torneo
  year        int check (year is null or year between 1850 and 2100),
  day         text check (day is null or day ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'), -- MM-DD de la efeméride
  slides      jsonb not null default '[]'::jsonb,                              -- [{text, image}]
  tags        text[] not null default '{}'::text[],
  caption     text check (caption is null or char_length(caption) <= 2200),    -- texto para TikTok / redes
  sources     text check (sources is null or char_length(sources) <= 1000),    -- de dónde salen los datos
  status      text not null default 'draft' check (status in ('draft', 'published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists capsules_feed_idx on public.capsules (status, kind, created_at desc);
create index if not exists capsules_day_idx on public.capsules (day) where day is not null;

alter table public.capsules enable row level security;  -- solo el backend (clave secreta)
