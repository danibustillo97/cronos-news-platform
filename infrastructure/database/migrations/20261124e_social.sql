-- Reacciones y comentarios del feed (noticias, cápsulas, encuestas).
-- Reaccionar es anónimo (hash de un id del navegador); una reacción por persona y pieza.
-- Comentar pide un nombre; los comentarios con enlaces o groserías quedan pendientes de moderación.

create table if not exists public.reactions (
  target_type text not null check (target_type in ('news', 'capsule', 'poll', 'picks')),
  target_id   text not null check (char_length(target_id) between 1 and 80),
  voter_hash  text not null,
  reaction    text not null check (reaction in ('fire', 'goal', 'wow', 'clap', 'laugh', 'sad')),
  created_at  timestamptz not null default now(),
  primary key (target_type, target_id, voter_hash)
);

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('news', 'capsule', 'poll', 'picks')),
  target_id   text not null check (char_length(target_id) between 1 and 80),
  author      text not null check (char_length(author) between 2 and 40),
  body        text not null check (char_length(body) between 1 and 500),
  voter_hash  text not null,
  status      text not null default 'visible' check (status in ('visible', 'pending', 'hidden')),
  created_at  timestamptz not null default now()
);

create index if not exists comments_target_idx on public.comments (target_type, target_id, created_at desc) where status = 'visible';
create index if not exists comments_voter_idx on public.comments (voter_hash, created_at desc);
create index if not exists comments_status_idx on public.comments (status, created_at desc);

alter table public.reactions enable row level security;
alter table public.comments enable row level security;

-- Conteo de reacciones por tipo para una pieza.
create or replace function public.reaction_counts(p_type text, p_id text)
returns table (reaction text, n bigint)
language sql stable security definer set search_path = public as $$
  select reaction, count(*) from reactions where target_type = p_type and target_id = p_id group by reaction;
$$;

revoke all on function public.reaction_counts(text, text) from public, anon, authenticated;
