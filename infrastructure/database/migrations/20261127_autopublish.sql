-- Publicación automática con control de plagio (piloto editorial).
-- auto_publish: el piloto publica sin aprobación humana SOLO si el borrador pasó
-- las validaciones bloqueantes y el detector de plagio (originalidad >= min_originality
-- y ninguna frase copiada). Todo lo demás queda en Revisión. Apagado por defecto.
begin;
alter table public.editorial_automation
  add column if not exists auto_publish boolean not null default false,
  add column if not exists min_originality integer not null default 85
    check (min_originality between 60 and 100);
commit;
