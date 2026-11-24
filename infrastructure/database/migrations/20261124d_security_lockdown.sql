-- ============================================================================
-- 2026-11-24 (d) · CRONOS public-schema access lockdown
--
-- STATUS: REVIEW DRAFT. This file is committed only to the feature branch.
-- It is NOT executed by GitHub Actions or Vercel.
-- DO NOT run against production until the owner has reviewed the full SQL and
-- confirmed the intended rollout window.
--
-- Live-schema baseline checked against NEWS_DEPORT (mxvdnfaeqjifnxqmxbri):
--   * 39 public tables; match_results was the only public table with RLS off.
--   * anon/authenticated held broad table grants, including TRUNCATE,
--     REFERENCES and TRIGGER on most public tables.
--   * several internal tables had read_all / write_authenticated / dev_all_access.
--   * one Auth user has app_metadata.role = 'admin'.
--
-- Access model after this migration:
--   * public portal reads: published news, categories, category_groups, topics,
--     active ad banners, and public media objects.
--   * user-owned rows: football_broadcast_matches, restricted by auth.uid().
--   * all editorial/automation/production/credentials/job tables: server-only
--     through the FastAPI/Next server clients using SUPABASE_SECRET_KEY.
--   * analytics writes: a narrowly validated, rate-limited public RPC.
--   * analytics dashboard: authenticated admins only.
--
-- Important:
--   * Keep cronos_private OUT of Supabase's Data API exposed schemas.
--   * Backend and GitHub workers must continue using the server-only secret key.
--   * The legacy increment_news_view RPC had no application call sites and is
--     restricted to service_role.
--   * Signed media uploads must continue to be issued by the admin-protected
--     backend route; createSignedUploadUrl tokens are capability URLs that can
--     upload without a second authentication step.
--   * No rows are deleted or rewritten by this migration.
-- ============================================================================

begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- Fail early if this draft is pointed at a database with a different baseline.
do $preflight$
begin
  if to_regclass('public.news') is null
     or to_regclass('public.match_results') is null
     or to_regclass('public.football_broadcast_matches') is null
     or to_regclass('public.tiktok_accounts') is null
     or to_regclass('public.site_analytics_events') is null
     or to_regclass('public.site_analytics_maintenance') is null then
    raise exception 'CRONOS security migration preflight failed: expected public tables are missing';
  end if;

  if to_regprocedure('public.record_site_analytics_event(uuid,text,text,text,boolean,text,text,text,text,text,text,text,text)') is null
     or to_regprocedure('public.get_site_analytics_dashboard(integer)') is null
     or to_regprocedure('public.cast_poll_vote(uuid,uuid,text)') is null
     or to_regprocedure('public.increment_news_view(uuid)') is null then
    raise exception 'CRONOS security migration preflight failed: expected RPC functions are missing';
  end if;
end
$preflight$;

-- Private schema for implementation functions. Never add this schema to the
-- Supabase REST/GraphQL "Exposed schemas" configuration.
create schema if not exists cronos_private;
comment on schema cronos_private is
  'CRONOS internal functions. Do not expose through Supabase Data API.';

revoke all on schema cronos_private from public, anon, authenticated;
grant usage on schema cronos_private to anon, authenticated;

-- Fail closed for future objects created by postgres in these schemas.
-- New public tables/functions must receive explicit grants and RLS policies.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema cronos_private
  revoke execute on functions from public, anon, authenticated;

-- Trusted admin predicate. Authorization comes only from Supabase app_metadata,
-- never user_metadata. The allow-list matches backend/app/presentation/auth.py.
create or replace function cronos_private.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select coalesce(
    (select auth.jwt() -> 'app_metadata' ->> 'role'),
    ''
  ) in ('admin', 'administrator', 'editor');
$function$;

revoke all on function cronos_private.is_admin() from public;
revoke all on function cronos_private.is_admin() from anon, authenticated;
grant execute on function cronos_private.is_admin() to anon, authenticated;

-- Turn on RLS everywhere in public and remove every current policy. We rebuild
-- only the few client-facing policies below. All other public tables become
-- service-role-only (service_role retains its direct grants and BYPASSRLS).
do $rls$
declare
  t record;
  p record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format('alter table public.%I enable row level security', t.tablename);

    for p in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = t.tablename
    loop
      execute format('drop policy %I on public.%I', p.policyname, t.tablename);
    end loop;
  end loop;
end
$rls$;

-- RLS does not replace SQL grants. Remove broad table rights (including
-- TRUNCATE / TRIGGER / REFERENCES) from public API roles. service_role keeps
-- its pre-existing direct privileges, verified in the live database.
revoke all privileges on all tables in schema public
  from public, anon, authenticated;
revoke all privileges on all sequences in schema public
  from public, anon, authenticated;

-- Public portal data: browser clients can read but never write these tables.
grant select on table
  public.news,
  public.category_groups,
  public.categories,
  public.topics,
  public.ad_banners
to anon, authenticated;

-- A broadcaster can manage only their own saved match workspace.
grant select, insert, update, delete
  on table public.football_broadcast_matches
  to authenticated;

-- NEWS: public readers see published articles; admins can also see drafts.
create policy news_read_published_or_admin
  on public.news
  for select
  to anon, authenticated
  using (
    status = 'published'
    or (select cronos_private.is_admin())
  );

-- Taxonomy is public read-only. All writes go through the FastAPI service role.
create policy category_groups_public_read
  on public.category_groups
  for select to anon, authenticated
  using (true);

create policy categories_public_read
  on public.categories
  for select to anon, authenticated
  using (true);

create policy topics_public_read
  on public.topics
  for select to anon, authenticated
  using (true);

-- Public banners are read-only and only active placements are visible.
create policy ad_banners_public_read_active
  on public.ad_banners
  for select to anon, authenticated
  using (active = true);

-- Per-user football broadcast workspaces. auth.uid() is evaluated once per
-- statement with the SELECT wrapper, not once per row.
create policy football_broadcast_matches_select_own
  on public.football_broadcast_matches
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy football_broadcast_matches_insert_own
  on public.football_broadcast_matches
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy football_broadcast_matches_update_own
  on public.football_broadcast_matches
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy football_broadcast_matches_delete_own
  on public.football_broadcast_matches
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Internal content, workflow, job and credential tables intentionally have
-- RLS enabled, no client policies, and no anon/authenticated SQL grants:
-- match_results, stories, claims, hooks, pieces, export_jobs, tiktok_accounts,
-- story_intelligence, productions, compositions, assets, distribution_plans,
-- publication_records, runtime_registrations, production_jobs, artifacts,
-- artifact_jobs, media_generation_jobs, discovery_items, discovery_jobs,
-- site_settings, studio_projects, site_analytics_events,
-- site_analytics_maintenance, editorial_automation, content_profile,
-- portal_layout, radio_tracks, polls, poll_options, poll_votes, story_sources.
-- These are accessed only through server-side service-role repositories and
-- protected application endpoints. match_results' 381 historical rows remain
-- in place; the old direct-browser widget is not referenced by the app.

-- Storage media is public-read only. Uploads are issued through the
-- admin-protected backend endpoint using createSignedUploadUrl; those signed
-- upload tokens are intended to work without a second client authentication.
-- Remove the broad policy that let every authenticated account upload.
drop policy if exists "Authenticated upload media" on storage.objects;
drop policy if exists "Public Upload Access" on storage.objects;
drop policy if exists "Authenticated Upload Access" on storage.objects;
drop policy if exists "Authenticated Update Access" on storage.objects;
drop policy if exists "Authenticated Delete Access" on storage.objects;
drop policy if exists "Public Update Access" on storage.objects;
drop policy if exists "Public Delete Access" on storage.objects;
drop policy if exists "Public Read Access" on storage.objects;
drop policy if exists "Public read media" on storage.objects;

create policy media_public_read
  on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

-- Move analytics implementation functions out of the exposed public schema.
-- Public wrappers below keep the existing PostgREST RPC names stable.
do $move_analytics$
begin
  if to_regprocedure(
       'public.record_site_analytics_event(uuid,text,text,text,boolean,text,text,text,text,text,text,text,text)'
     ) is not null
     and to_regprocedure(
       'cronos_private.record_site_analytics_event(uuid,text,text,text,boolean,text,text,text,text,text,text,text,text)'
     ) is null then
    execute
      'alter function public.record_site_analytics_event(uuid,text,text,text,boolean,text,text,text,text,text,text,text,text) set schema cronos_private';
  end if;

  if to_regprocedure('public.get_site_analytics_dashboard(integer)') is not null
     and to_regprocedure('cronos_private.get_site_analytics_dashboard(integer)') is null then
    execute
      'alter function public.get_site_analytics_dashboard(integer) set schema cronos_private';
  end if;
end
$move_analytics$;

alter function cronos_private.record_site_analytics_event(
  uuid, text, text, text, boolean, text, text, text, text, text, text, text, text
) set search_path = '';

alter function cronos_private.get_site_analytics_dashboard(integer)
  set search_path = '';

-- The event writer is intentionally callable by anon: it validates the event,
-- serializes per-session writes, rate-limits at 120 events / 10 minutes, and
-- performs 90-day cleanup. Its SECURITY DEFINER implementation is private.
revoke all on function cronos_private.record_site_analytics_event(
  uuid, text, text, text, boolean, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function cronos_private.record_site_analytics_event(
  uuid, text, text, text, boolean, text, text, text, text, text, text, text, text
) to anon, authenticated;

create or replace function public.record_site_analytics_event(
  p_session_id uuid,
  p_event_type text,
  p_page_path text,
  p_device_type text,
  p_is_entry boolean default false,
  p_referrer_domain text default null,
  p_utm_source text default null,
  p_utm_medium text default null,
  p_utm_campaign text default null,
  p_element_label text default null,
  p_target_path text default null,
  p_country_code text default null,
  p_region_code text default null
)
returns boolean
language sql
security invoker
set search_path = ''
as $wrapper$
  select cronos_private.record_site_analytics_event(
    p_session_id,
    p_event_type,
    p_page_path,
    p_device_type,
    p_is_entry,
    p_referrer_domain,
    p_utm_source,
    p_utm_medium,
    p_utm_campaign,
    p_element_label,
    p_target_path,
    p_country_code,
    p_region_code
  );
$wrapper$;

revoke all on function public.record_site_analytics_event(
  uuid, text, text, text, boolean, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_site_analytics_event(
  uuid, text, text, text, boolean, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- Dashboard implementation stays private and can only be reached through the
-- public wrapper below, which checks the trusted app_metadata admin claim.
revoke all on function cronos_private.get_site_analytics_dashboard(integer)
  from public, anon, authenticated;
grant execute on function cronos_private.get_site_analytics_dashboard(integer)
  to authenticated;

create or replace function public.get_site_analytics_dashboard(
  p_days integer default 7
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $wrapper$
begin
  if not cronos_private.is_admin() then
    raise exception 'Administrator access required'
      using errcode = '42501';
  end if;

  return cronos_private.get_site_analytics_dashboard(p_days);
end;
$wrapper$;

revoke all on function public.get_site_analytics_dashboard(integer)
  from public, anon, authenticated;
grant execute on function public.get_site_analytics_dashboard(integer)
  to authenticated;

-- No call sites for increment_news_view exist in the active repository.
-- Keep the legacy RPC server-only, and pin its search_path.
alter function public.increment_news_view(uuid) set search_path = '';
revoke all on function public.increment_news_view(uuid)
  from public, anon, authenticated;
grant execute on function public.increment_news_view(uuid) to service_role;

-- Poll votes are invoked only by the backend service client. Pin its path and
-- schema-qualify every table so SECURITY DEFINER cannot be shadowed.
create or replace function public.cast_poll_vote(
  p_poll uuid,
  p_option uuid,
  p_voter text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
  v_closes timestamptz;
  v_rows integer;
begin
  select status, closes_at
    into v_status, v_closes
    from public.polls
    where id = p_poll;

  if v_status is null then
    return 'invalid';
  end if;

  if v_status <> 'open'
     or (v_closes is not null and v_closes <= now()) then
    return 'closed';
  end if;

  if not exists (
    select 1
    from public.poll_options
    where id = p_option and poll_id = p_poll
  ) then
    return 'invalid';
  end if;

  insert into public.poll_votes (poll_id, voter_hash, option_id)
  values (p_poll, p_voter, p_option)
  on conflict (poll_id, voter_hash) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return 'duplicate';
  end if;

  update public.poll_options
    set votes = votes + 1
    where id = p_option;

  return 'ok';
end;
$function$;

revoke all on function public.cast_poll_vote(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cast_poll_vote(uuid, uuid, text)
  to service_role;

-- Existing trigger helpers do not need a mutable schema search path.
alter function public.update_updated_at_column() set search_path = '';
alter function public.touch_football_broadcast_matches_updated_at() set search_path = '';

-- Refresh PostgREST after moving the private implementations and creating
-- the stable public RPC wrappers.
notify pgrst, 'reload schema';

commit;

-- ============================================================================
-- POST-APPLY VERIFICATION (run separately after the migration is approved):
--
-- 1) Public tables with RLS disabled must return zero rows:
--    select schemaname, tablename from pg_tables t
--    where schemaname='public'
--      and not coalesce((select c.relrowsecurity
--        from pg_class c join pg_namespace n on n.oid=c.relnamespace
--        where n.nspname=t.schemaname and c.relname=t.tablename), false);
--
-- 2) Client roles should have table grants only on:
--    news, category_groups, categories, topics, ad_banners,
--    football_broadcast_matches (authenticated only).
--
-- 3) Policies expected:
--    news_read_published_or_admin; category_groups_public_read;
--    categories_public_read; topics_public_read; ad_banners_public_read_active;
--    four football_broadcast_matches_*_own policies; media_public_read.
--
-- 4) Verify /api/categories, public published news, public active ad banners,
--    /api/polls, /api/portal/layout, /api/radio/tracks (admin), TikTok account
--    routes (admin), football broadcast own-row read/write, and the two
--    analytics RPC flows (anonymous event insert; admin dashboard).
--
-- 5) Re-run Supabase security/performance advisors. Expected deliberate
--    exception: cronos_private contains SECURITY DEFINER implementations but
--    is not exposed to PostgREST; its public wrappers are SECURITY INVOKER.
-- ============================================================================
