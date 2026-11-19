# Proposed Supabase RLS Review

This document proposes SQL for a staging security review. It must not be executed without authorization and must not be treated as a migration.

## Existing public reads

```sql
alter table public.news enable row level security;

drop policy if exists "Public can view published news" on public.news;
create policy "Public can view published news"
  on public.news for select
  using (status = 'published');
```

The public site may read only `news.status = 'published'`.

## Administrative writes

The proposed role check must use a trusted Supabase JWT claim such as `app_metadata.role`. It must not use `user_metadata.role`.

```sql
create or replace function public.cronos_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.role() = 'authenticated'
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
      in ('admin', 'administrator', 'editor');
$$;
```

This function affects authorization and should be reviewed for `search_path`, privileges and revoked function grants before use.

```sql
-- Apply separately to every private table verified in staging:
alter table public.cronos_stories enable row level security;
alter table public.stories enable row level security;
alter table public.artifacts enable row level security;
alter table public.artifact_jobs enable row level security;
alter table public.discovery_items enable row level security;
alter table public.discovery_jobs enable row level security;
alter table public.production_jobs enable row level security;
alter table public.media_generation_jobs enable row level security;
alter table public.assets enable row level security;
alter table public.publication_records enable row level security;
alter table public.studio_projects enable row level security;
alter table public.site_settings enable row level security;
```

For each table verified in staging:

```sql
drop policy if exists "public_read" on public.TABLE_NAME;
drop policy if exists "admin_read" on public.TABLE_NAME;
drop policy if exists "admin_write" on public.TABLE_NAME;

create policy "admin_read" on public.TABLE_NAME
  for select to authenticated
  using (public.cronos_is_admin());

create policy "admin_write" on public.TABLE_NAME
  for all to authenticated
  using (public.cronos_is_admin())
  with check (public.cronos_is_admin());
```

Replace `TABLE_NAME` with one real table. Do not run this as an automated migration.

## Worker writes

GitHub Actions workers use `SUPABASE_SERVICE_ROLE_KEY`. This is server-only and bypasses RLS. Worker authorization must be enforced by repository-controlled workflow secrets and atomic status transitions.

Workers may write:

- `artifacts`
- `artifact_jobs`
- `discovery_items`
- `discovery_jobs`
- `media_generation_jobs`
- `news`

No public browser client must receive service-role credentials.

## Private OAuth tokens

The repository currently queries `tiktok_accounts` by `user_id`. Table and columns are not confirmed in the live staging project.

Do not create or assume:

- `tiktok_accounts`
- `access_token_encrypted`
- `refresh_token_encrypted`
- `user_id`

If `tiktok_accounts` exists, staging must confirm whether its real schema contains plaintext `access_token`/`refresh_token` columns. Token rows must not be readable through anon or authenticated browser clients. If the table or required columns do not exist, do not use it until the owner authorizes schema changes.

If confirmed existing, the policy shape is:

```sql
alter table public.tiktok_accounts enable row level security;

revoke all on public.tiktok_accounts from anon;

create policy "tiktok_owner_read"
  on public.tiktok_accounts for select to authenticated
  using (auth.uid() = user_id);

create policy "tiktok_owner_write"
  on public.tiktok_accounts for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Column-level privileges must also be reviewed:

```sql
revoke select(access_token, refresh_token)
  on public.tiktok_accounts from authenticated;
```

Do not reveal that policy exists without confirming `tiktok_accounts.user_id` and column names in staging.

## Storage

Public reads may remain public for public media. Writes require authentication and a trusted admin claim.

```sql
drop policy if exists "Public Upload Access" on storage.objects;
drop policy if exists "Public Update Access" on storage.objects;
drop policy if exists "Public Delete Access" on storage.objects;

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
```

Existing public read policy may remain:

```sql
create policy "media_public_read"
  on storage.objects for select
  using (bucket_id = 'media');
```
