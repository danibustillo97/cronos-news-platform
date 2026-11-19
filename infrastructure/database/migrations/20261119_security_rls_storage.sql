-- CRONOS security remediation migration
-- Applies policies only. Run manually after review. Idempotent.

create or replace function public.cronos_is_admin()
returns boolean
language sql
stable
as $$
  select
    auth.role() = 'authenticated'
    and (
      coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'administrator', 'editor')
      or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'owner'
    );
$$;

-- Private operational tables: authenticated users read, admins write.
do $$
declare
  t text;
begin
  foreach t in array array[
    'category_groups','topics','cronos_stories','story_sources',
    'story_intelligence','productions','compositions','assets',
    'distribution_plans','publication_records','runtime_registrations',
    'production_jobs','discovery_items','discovery_jobs',
    'artifacts','artifact_jobs','media_generation_jobs',
    'studio_projects','site_settings'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "read_all" on public.%I', t);
      execute format('drop policy if exists "Public can view published news" on public.%I', t);
      execute format('drop policy if exists "write_authenticated" on public.%I', t);
      execute format(
        'create policy "authenticated_admin_read" on public.%I for select to authenticated using (public.cronos_is_admin())',
        t
      );
      execute format(
        'create policy "authenticated_admin_write" on public.%I for all to authenticated using (public.cronos_is_admin()) with check (public.cronos_is_admin())',
        t
      );
    end if;
  end loop;
end $$;

-- Published news remains public, while writes are admin-only.
alter table public.news enable row level security;
drop policy if exists "Public can view published news" on public.news;
drop policy if exists "Enable all access for now" on public.news;
create policy "public_read_published_news"
  on public.news for select
  using (status = 'published');
create policy "admin_write_news"
  on public.news for all to authenticated
  using (public.cronos_is_admin())
  with check (public.cronos_is_admin());

-- Categories remain public for reads; writes require an admin.
alter table public.categories enable row level security;
drop policy if exists "Public read categories" on public.categories;
drop policy if exists "Enable all access for now" on public.categories;
create policy "public_read_categories"
  on public.categories for select using (true);
create policy "admin_write_categories"
  on public.categories for all to authenticated
  using (public.cronos_is_admin())
  with check (public.cronos_is_admin());

-- Public ad placements remain readable, writes are admin-only.
alter table public.ad_banners enable row level security;
drop policy if exists "ad_public_read" on public.ad_banners;
drop policy if exists "ad_admin_write" on public.ad_banners;
create policy "ad_public_read"
  on public.ad_banners for select using (active = true);
create policy "ad_admin_write"
  on public.ad_banners for all to authenticated
  using (public.cronos_is_admin())
  with check (public.cronos_is_admin());

-- TikTok OAuth credentials are server-managed and never readable by clients.
create table if not exists public.tiktok_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  open_id text not null,
  access_token text,
  refresh_token text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_in bigint,
  created_at timestamptz not null default now(),
  user_info jsonb not null default '{}',
  unique(user_id, open_id)
);

alter table public.tiktok_accounts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tiktok_accounts add column if not exists open_id text;
alter table public.tiktok_accounts add column if not exists access_token_encrypted text;
alter table public.tiktok_accounts add column if not exists refresh_token_encrypted text;
alter table public.tiktok_accounts add column if not exists expires_in bigint;
alter table public.tiktok_accounts add column if not exists created_at timestamptz not null default now();
alter table public.tiktok_accounts add column if not exists user_info jsonb not null default '{}';
create unique index if not exists tiktok_accounts_user_open_key
  on public.tiktok_accounts(user_id, open_id);
alter table public.tiktok_accounts enable row level security;

drop policy if exists "tiktok_owner_read" on public.tiktok_accounts;
drop policy if exists "tiktok_owner_write" on public.tiktok_accounts;
drop policy if exists "tiktok_no_anon" on public.tiktok_accounts;

create policy "tiktok_admin_read"
  on public.tiktok_accounts for select to authenticated
  using (public.cronos_is_admin() and user_id = auth.uid());
create policy "tiktok_admin_write"
  on public.tiktok_accounts for all to authenticated
  using (public.cronos_is_admin() and user_id = auth.uid())
  with check (public.cronos_is_admin() and user_id = auth.uid());

-- Plaintext and encrypted token columns are never client-accessible.
revoke all on public.tiktok_accounts from anon;
revoke select(access_token, refresh_token, access_token_encrypted, refresh_token_encrypted)
  on public.tiktok_accounts from authenticated;

-- Storage: media remains publicly readable, but only admins may write.
drop policy if exists "Public Read Access" on storage.objects;
drop policy if exists "Public Upload Access" on storage.objects;
drop policy if exists "Public Update Access" on storage.objects;
drop policy if exists "Public Delete Access" on storage.objects;

create policy "media_public_read"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "media_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.cronos_is_admin());

create policy "media_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.cronos_is_admin())
  with check (bucket_id = 'media' and public.cronos_is_admin());

create policy "media_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.cronos_is_admin());
