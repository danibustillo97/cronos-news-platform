  -- Football Broadcast Studio: one durable match workspace per user.
  create table if not exists public.football_broadcast_matches (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null default 'Partido sin título',
    competition text not null default '',
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists football_broadcast_matches_user_updated_idx
    on public.football_broadcast_matches(user_id, updated_at desc);

  alter table public.football_broadcast_matches enable row level security;

  drop policy if exists football_broadcast_matches_select on public.football_broadcast_matches;
  create policy football_broadcast_matches_select
    on public.football_broadcast_matches for select
    using (auth.uid() = user_id);

  drop policy if exists football_broadcast_matches_insert on public.football_broadcast_matches;
  create policy football_broadcast_matches_insert
    on public.football_broadcast_matches for insert
    with check (auth.uid() = user_id);

  drop policy if exists football_broadcast_matches_update on public.football_broadcast_matches;
  create policy football_broadcast_matches_update
    on public.football_broadcast_matches for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

  drop policy if exists football_broadcast_matches_delete on public.football_broadcast_matches;
  create policy football_broadcast_matches_delete
    on public.football_broadcast_matches for delete
    using (auth.uid() = user_id);

  create or replace function public.touch_football_broadcast_matches_updated_at()
  returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;

  drop trigger if exists football_broadcast_matches_touch_updated_at on public.football_broadcast_matches;
  create trigger football_broadcast_matches_touch_updated_at
  before update on public.football_broadcast_matches
  for each row execute function public.touch_football_broadcast_matches_updated_at();
