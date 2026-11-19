-- First-party, session-scoped site analytics for the public portal.
-- Run in Supabase SQL Editor. No IP addresses, user agents, or identities
-- are stored. Event-level records are cleaned after 90 days.

create table if not exists public.site_analytics_events (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  event_type text not null check (event_type in ('page_view', 'click')),
  page_path text not null check (left(page_path, 1) = '/' and length(page_path) <= 300),
  device_type text not null check (device_type in ('mobile', 'tablet', 'desktop')),
  is_entry boolean not null default false,
  referrer_domain text check (referrer_domain is null or length(referrer_domain) <= 253),
  utm_source text check (utm_source is null or length(utm_source) <= 120),
  utm_medium text check (utm_medium is null or length(utm_medium) <= 120),
  utm_campaign text check (utm_campaign is null or length(utm_campaign) <= 120),
  element_label text check (element_label is null or length(element_label) <= 100),
  target_path text check (target_path is null or length(target_path) <= 300),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  region_code text check (region_code is null or region_code ~ '^[A-Z0-9-]{1,12}$'),
  created_at timestamptz not null default now()
);

alter table public.site_analytics_events
  add column if not exists country_code text,
  add column if not exists region_code text;

create index if not exists site_analytics_events_created_at_idx
  on public.site_analytics_events (created_at desc);
create index if not exists site_analytics_events_session_created_idx
  on public.site_analytics_events (session_id, created_at);
create index if not exists site_analytics_events_type_created_idx
  on public.site_analytics_events (event_type, created_at);

create table if not exists public.site_analytics_maintenance (
  id boolean primary key default true check (id),
  last_cleanup_at timestamptz not null default now()
);
insert into public.site_analytics_maintenance (id) values (true)
on conflict (id) do nothing;

alter table public.site_analytics_events enable row level security;
revoke all on public.site_analytics_events from public, anon, authenticated;
revoke all on public.site_analytics_maintenance from public, anon, authenticated;

drop function if exists public.record_site_analytics_event(uuid, text, text, text, boolean, text, text, text, text, text, text);

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
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recent_events integer;
begin
  if p_session_id is null
    or p_event_type is null
    or p_event_type not in ('page_view', 'click')
    or p_device_type is null
    or p_device_type not in ('mobile', 'tablet', 'desktop')
    or p_page_path is null
    or left(p_page_path, 1) <> '/'
    or left(p_page_path, 2) = '//'
    or position('?' in p_page_path) > 0
    or position('#' in p_page_path) > 0
    or length(p_page_path) > 300 then
    raise exception 'Invalid analytics event';
  end if;

  if p_event_type <> 'page_view' and coalesce(p_is_entry, false) then
    raise exception 'Only page views can be entry events';
  end if;
  if not (p_event_type = 'page_view' and coalesce(p_is_entry, false))
    and (p_referrer_domain is not null or p_utm_source is not null
    or p_utm_medium is not null or p_utm_campaign is not null) then
    raise exception 'Attribution is only allowed on entry page views';
  end if;
  if p_referrer_domain is not null and p_referrer_domain !~ '^[A-Za-z0-9.-]+$' then
    raise exception 'Invalid referrer domain';
  end if;
  if p_country_code is not null and p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Invalid country code';
  end if;
  if p_region_code is not null and p_region_code !~ '^[A-Z0-9-]{1,12}$' then
    raise exception 'Invalid region code';
  end if;
  if (p_country_code is not null or p_region_code is not null)
    and not (p_event_type = 'page_view' and coalesce(p_is_entry, false)) then
    raise exception 'Location is only allowed on entry page views';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_session_id::text));
  select count(*) into recent_events
  from public.site_analytics_events
  where session_id = p_session_id
    and created_at >= now() - interval '10 minutes';

  if recent_events >= 120 then
    return false;
  end if;

  insert into public.site_analytics_events (
    session_id, event_type, page_path, device_type, is_entry, referrer_domain,
    utm_source, utm_medium, utm_campaign, element_label, target_path,
    country_code, region_code
  ) values (
    p_session_id,
    p_event_type,
    p_page_path,
    p_device_type,
    coalesce(p_is_entry, false),
    left(nullif(p_referrer_domain, ''), 253),
    left(nullif(p_utm_source, ''), 120),
    left(nullif(p_utm_medium, ''), 120),
    left(nullif(p_utm_campaign, ''), 120),
    left(nullif(p_element_label, ''), 100),
    left(nullif(p_target_path, ''), 300),
    p_country_code,
    p_region_code
  );

  -- Opportunistic daily cleanup with no blocking between normal page events.
  if pg_try_advisory_xact_lock(7342871901) then
    update public.site_analytics_maintenance
    set last_cleanup_at = now()
    where id = true and last_cleanup_at < now() - interval '1 day';
    if found then
      delete from public.site_analytics_events
      where created_at < now() - interval '90 days';
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.get_site_analytics_dashboard(p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if auth.role() is distinct from 'authenticated' then
    raise exception 'Authentication required';
  end if;
  if p_days is null or p_days not in (7, 30) then
    raise exception 'Unsupported date range';
  end if;

  with recent as (
    select *
    from public.site_analytics_events
    where created_at >= date_trunc('day', now()) - make_interval(days => p_days - 1)
  ),
  previous as (
    select *
    from public.site_analytics_events
    where created_at >= date_trunc('day', now()) - make_interval(days => (p_days * 2) - 1)
      and created_at < date_trunc('day', now()) - make_interval(days => p_days - 1)
  ),
  daily as (
    select
      series.day::date as day,
      count(*) filter (where e.event_type = 'page_view')::integer as pageviews,
      count(distinct e.session_id) filter (where e.event_type = 'page_view')::integer as sessions,
      count(*) filter (where e.event_type = 'click')::integer as clicks
    from generate_series(
      date_trunc('day', now()) - make_interval(days => p_days - 1),
      date_trunc('day', now()),
      interval '1 day'
    ) as series(day)
    left join recent e on date_trunc('day', e.created_at) = series.day
    group by series.day
  ),
  totals as (
    select
      count(*) filter (where event_type = 'page_view')::integer as pageviews,
      count(distinct session_id) filter (where event_type = 'page_view')::integer as sessions,
      count(*) filter (where event_type = 'click')::integer as clicks,
      count(distinct session_id) filter (where event_type = 'click')::integer as engaged_sessions
    from recent
  ),
  previous_totals as (
    select
      count(*) filter (where event_type = 'page_view')::integer as pageviews,
      count(distinct session_id) filter (where event_type = 'page_view')::integer as sessions,
      count(*) filter (where event_type = 'click')::integer as clicks,
      count(distinct session_id) filter (where event_type = 'click')::integer as engaged_sessions
    from previous
  ),
  pages as (
    select page_path, count(*)::integer as pageviews, count(distinct session_id)::integer as sessions
    from recent where event_type = 'page_view'
    group by page_path order by pageviews desc, page_path limit 8
  ),
  sources as (
    select
      coalesce(nullif(utm_source, ''), nullif(referrer_domain, ''), 'Directo') as source,
      count(distinct session_id)::integer as sessions
    from recent
    where event_type = 'page_view' and is_entry
    group by 1 order by sessions desc, source limit 8
  ),
  countries as (
    select country_code, count(distinct session_id)::integer as sessions
    from recent
    where event_type = 'page_view' and is_entry and country_code is not null
    group by country_code order by sessions desc, country_code limit 10
  ),
  locations as (
    select country_code, coalesce(region_code, '') as region_code,
      count(distinct session_id)::integer as sessions
    from recent
    where event_type = 'page_view' and is_entry
      and country_code is not null
    group by country_code, region_code order by sessions desc, country_code, region_code limit 10
  ),
  devices as (
    select device_type, count(distinct session_id)::integer as sessions
    from recent
    where event_type = 'page_view' and is_entry
    group by device_type order by sessions desc, device_type
  ),
  campaigns as (
    select utm_source as source, coalesce(nullif(utm_campaign, ''), '(sin campaña)') as campaign,
      count(distinct session_id)::integer as sessions
    from recent
    where event_type = 'page_view' and is_entry and utm_source is not null
    group by 1, 2 order by sessions desc, source, campaign limit 8
  ),
  clicks_by_target as (
    select coalesce(nullif(element_label, ''), 'Clic sin etiqueta') as label,
      target_path, count(*)::integer as clicks
    from recent where event_type = 'click'
    group by 1, 2 order by clicks desc, label limit 8
  )
  select jsonb_build_object(
    'days', p_days,
    'pageviews', totals.pageviews,
    'sessions', totals.sessions,
    'clicks', totals.clicks,
    'engagedSessions', totals.engaged_sessions,
    'previousPageviews', previous_totals.pageviews,
    'previousSessions', previous_totals.sessions,
    'previousClicks', previous_totals.clicks,
    'previousEngagedSessions', previous_totals.engaged_sessions,
    'clickRate', case when totals.sessions = 0 then 0
      else round(100.0 * totals.engaged_sessions / totals.sessions, 1) end,
    'pagesPerSession', case when totals.sessions = 0 then 0
      else round(1.0 * totals.pageviews / totals.sessions, 1) end,
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'date', to_char(day, 'YYYY-MM-DD'), 'pageviews', pageviews, 'sessions', sessions, 'clicks', clicks
    ) order by day) from daily), '[]'::jsonb),
    'topPages', coalesce((select jsonb_agg(jsonb_build_object(
      'path', page_path, 'pageviews', pageviews, 'sessions', sessions
    ) order by pageviews desc, page_path) from pages), '[]'::jsonb),
    'topReferrers', coalesce((select jsonb_agg(jsonb_build_object(
      'source', source, 'sessions', sessions
    ) order by sessions desc, source) from sources), '[]'::jsonb),
    'topCountries', coalesce((select jsonb_agg(jsonb_build_object(
      'countryCode', country_code, 'sessions', sessions
    ) order by sessions desc, country_code) from countries), '[]'::jsonb),
    'topLocations', coalesce((select jsonb_agg(jsonb_build_object(
      'countryCode', country_code, 'regionCode', region_code, 'sessions', sessions
    ) order by sessions desc, country_code, region_code) from locations), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object(
      'device', device_type, 'sessions', sessions
    ) order by sessions desc, device_type) from devices), '[]'::jsonb),
    'topCampaigns', coalesce((select jsonb_agg(jsonb_build_object(
      'source', source, 'campaign', campaign, 'sessions', sessions
    ) order by sessions desc, source, campaign) from campaigns), '[]'::jsonb),
    'topClicks', coalesce((select jsonb_agg(jsonb_build_object(
      'label', label, 'targetPath', target_path, 'clicks', clicks
    ) order by clicks desc, label) from clicks_by_target), '[]'::jsonb)
  ) into result
  from totals
  cross join previous_totals;

  return result;
end;
$$;

revoke all on function public.record_site_analytics_event(uuid, text, text, text, boolean, text, text, text, text, text, text, text, text) from public;
grant execute on function public.record_site_analytics_event(uuid, text, text, text, boolean, text, text, text, text, text, text, text, text) to anon, authenticated;
revoke all on function public.get_site_analytics_dashboard(integer) from public, anon;
grant execute on function public.get_site_analytics_dashboard(integer) to authenticated;
