-- =============================================================================
-- 0002 — Produtos / Anuncios
-- =============================================================================

create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  seller_id         uuid not null references public.profiles (id) on delete cascade,
  title             text not null check (length(trim(title)) between 3 and 160),
  description       text not null default '' check (length(description) <= 8000),
  images            text[] not null default '{}'::text[]
                      check (cardinality(images) <= 12),
  -- Preco final pago pelo comprador, em centavos.
  amount_total_cents bigint not null check (amount_total_cents >= 100),
  -- Comissao do afiliado em basis points (1500 = 15,00%).
  commission_bps    integer not null check (commission_bps between 0 and 10000),
  status            public.product_status not null default 'ativo',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists products_seller_idx on public.products (seller_id);
create index if not exists products_status_idx on public.products (status)
  where status = 'ativo';
create index if not exists products_created_idx on public.products (created_at desc);

drop trigger if exists touch_products on public.products;
create trigger touch_products before update on public.products
  for each row execute function app.touch_updated_at();

-- Garante que a comissao definida pelo vendedor respeita os limites globais.
create or replace function app.validate_product_commission()
returns trigger
language plpgsql
as $$
declare
  v_min bigint := public.setting_int('min_commission_bps', 0);
  v_max bigint := public.setting_int('max_commission_bps', 5000);
begin
  if new.commission_bps < v_min or new.commission_bps > v_max then
    raise exception
      'Comissao % bps fora dos limites permitidos (% a % bps)',
      new.commission_bps, v_min, v_max
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_product_commission on public.products;
create trigger validate_product_commission
  before insert or update of commission_bps on public.products
  for each row execute function app.validate_product_commission();

-- View de leitura publica com a simulacao do split ja calculada.
-- security_invoker garante que a RLS da tabela base seja respeitada.
create or replace view public.products_with_split
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
