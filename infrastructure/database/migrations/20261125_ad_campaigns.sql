-- Espacios publicitarios por dispositivo y campañas de anunciantes.
-- Los espacios (nombre, ubicación y medidas exactas por dispositivo) viven en el código
-- (backend/app/domain/ads/slots.py); aquí se guarda si cada espacio está activo y las campañas.

create table if not exists public.ad_slot_settings (
  placement   text primary key,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists public.ad_campaigns (
  id             uuid primary key default gen_random_uuid(),
  placement      text not null,
  advertiser     text not null check (char_length(advertiser) between 1 and 120),
  href           text not null check (href ~ '^https://'),
  alt            text check (alt is null or char_length(alt) <= 200),
  image_mobile   text,
  image_tablet   text,
  image_desktop  text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  weight         int not null default 1 check (weight between 1 and 100),
  active         boolean not null default true,
  impressions    bigint not null default 0,
  clicks         bigint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (image_mobile is not null or image_tablet is not null or image_desktop is not null)
);

create index if not exists ad_campaigns_placement_idx on public.ad_campaigns (placement, active);

alter table public.ad_slot_settings enable row level security;
alter table public.ad_campaigns enable row level security;
