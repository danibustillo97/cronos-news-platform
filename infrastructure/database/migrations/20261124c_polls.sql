-- Encuestas y debates del portal.
-- Una encuesta tiene 2-6 opciones; un debate exactamente 2, cada una con su argumento.
-- Los votos se registran por votante anónimo (hash de un id del navegador) y se cuentan
-- en una función atómica para que un votante no pueda votar dos veces.

create table if not exists public.polls (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'poll' check (kind in ('poll', 'debate')),
  question    text not null check (char_length(question) between 3 and 200),
  context     text check (context is null or char_length(context) <= 600),
  status      text not null default 'open' check (status in ('draft', 'open', 'closed')),
  closes_at   timestamptz,
  news_id     text,
  featured    boolean not null default false,
  placement   text[] not null default array['home']::text[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.poll_options (
  id        uuid primary key default gen_random_uuid(),
  poll_id   uuid not null references public.polls(id) on delete cascade,
  label     text not null check (char_length(label) between 1 and 120),
  argument  text check (argument is null or char_length(argument) <= 400),
  position  int not null default 0,
  votes     int not null default 0 check (votes >= 0)
);

create table if not exists public.poll_votes (
  poll_id     uuid not null references public.polls(id) on delete cascade,
  voter_hash  text not null,
  option_id   uuid not null references public.poll_options(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (poll_id, voter_hash)
);

create index if not exists polls_status_idx on public.polls (status, featured desc, created_at desc);
create index if not exists polls_news_idx on public.polls (news_id) where news_id is not null;
create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);

-- Solo el backend (clave secreta) lee y escribe.
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

-- Voto atómico. Devuelve: ok | duplicate | closed | invalid
create or replace function public.cast_poll_vote(p_poll uuid, p_option uuid, p_voter text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_closes timestamptz;
  v_rows int;
begin
  select status, closes_at into v_status, v_closes from polls where id = p_poll;
  if v_status is null then return 'invalid'; end if;
  if v_status <> 'open' or (v_closes is not null and v_closes <= now()) then return 'closed'; end if;
  if not exists (select 1 from poll_options where id = p_option and poll_id = p_poll) then return 'invalid'; end if;

  insert into poll_votes (poll_id, voter_hash, option_id) values (p_poll, p_voter, p_option)
  on conflict (poll_id, voter_hash) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return 'duplicate'; end if;

  update poll_options set votes = votes + 1 where id = p_option;
  return 'ok';
end;
$$;

revoke all on function public.cast_poll_vote(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cast_poll_vote(uuid, uuid, text) to service_role;
