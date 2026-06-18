-- =============================================================================
-- 0013 — Atributos estruturados por categoria
-- =============================================================================
-- Cada anuncio passa a ter uma categoria (carros, celulares, ...) e um mapa
-- flexivel de atributos (jsonb). A definicao dos campos de cada categoria mora
-- no front (src/lib/categories.ts); aqui guardamos apenas chave/valor.
-- =============================================================================

alter table public.products
  add column if not exists category   text not null default 'outros',
  add column if not exists attributes jsonb not null default '{}'::jsonb;

-- Limite defensivo de tamanho do mapa de atributos (~8 KB serializado).
alter table public.products
  drop constraint if exists products_attributes_size;
alter table public.products
  add constraint products_attributes_size
  check (length(attributes::text) <= 8000);

-- A view expande `p.*` no momento da criacao, entao precisa ser recriada para
-- expor as novas colunas. `create or replace` nao aceita reordenar colunas, por
-- isso usamos drop + create.
drop view if exists public.products_with_split;

create view public.products_with_split
with (security_invoker = true) as
select
  p.*,
  public.setting_int('platform_fee_bps', 500)::int as platform_fee_bps,
  floor(p.amount_total_cents * p.commission_bps / 10000.0)::bigint as commission_cents,
  floor(p.amount_total_cents * public.setting_int('platform_fee_bps', 500) / 10000.0)::bigint as platform_fee_cents,
  (p.amount_total_cents
    - floor(p.amount_total_cents * p.commission_bps / 10000.0)::bigint
    - floor(p.amount_total_cents * public.setting_int('platform_fee_bps', 500) / 10000.0)::bigint
  ) as seller_net_cents
from public.products p;

-- Recriar a view zera os grants; reaplicamos a leitura publica.
grant select on public.products_with_split to anon, authenticated;
