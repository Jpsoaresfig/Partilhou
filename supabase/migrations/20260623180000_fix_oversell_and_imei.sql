-- =============================================================================
-- 0029 — Correcoes: anti-oversell (reserva do produto) + IMEI fora da view publica
-- =============================================================================
-- (a) OVERSELL: create_order so checava status='ativo' mas nunca reservava o
--     produto. Dois compradores podiam pagar pelo MESMO item unico. Resolvido por
--     trigger no ciclo de vida do pedido:
--       pedido criado  -> produto 'reservado' (some da vitrine, bloqueia 2o pedido)
--       fundos liberados-> produto 'vendido'
--       fundos estornados-> produto volta a 'ativo' (re-listavel)
--     A reserva acontece sob o lock FOR UPDATE que create_order ja faz no produto,
--     entao pedidos concorrentes serializam e o 2o ve 'reservado' -> erro.
--
-- (b) IMEI: a view publica products_with_split fazia `select p.*`, expondo o IMEI
--     a qualquer um (inclusive via PostgREST). Recriada com colunas EXPLICITAS,
--     SEM imei. Quem precisa do IMEI (validate/admin) le da tabela products via
--     service_role, nunca da view.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (a) Trigger de ciclo de vida do produto a partir do pedido.
-- -----------------------------------------------------------------------------
create or replace function app.sync_product_status_from_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Reserva o produto ao criar o pedido (anti-oversell de item unico).
    update public.products
       set status = 'reservado'
     where id = new.product_id and status = 'ativo';
  elsif tg_op = 'UPDATE' then
    if new.funds_state = 'liberado' and old.funds_state is distinct from 'liberado' then
      update public.products set status = 'vendido'
       where id = new.product_id and status <> 'excluido';
    elsif new.funds_state = 'estornado' and old.funds_state is distinct from 'estornado' then
      -- Venda caiu: produto volta a ficar disponivel.
      update public.products set status = 'ativo'
       where id = new.product_id and status not in ('excluido', 'vendido');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_product_status on public.orders;
create trigger sync_product_status
  after insert or update of funds_state on public.orders
  for each row execute function app.sync_product_status_from_order();

comment on function app.sync_product_status_from_order is
  'Reserva o produto ao criar pedido; marca vendido na liberacao; devolve a ativo no estorno. Evita oversell.';

-- -----------------------------------------------------------------------------
-- (b) Recria products_with_split SEM expor o IMEI.
--     Colunas explicitas (todas de products menos imei) + simulacao do split.
-- -----------------------------------------------------------------------------
drop view if exists public.products_with_split;

create view public.products_with_split
with (security_invoker = true) as
select
  p.id, p.seller_id, p.title, p.description, p.images,
  p.amount_total_cents, p.commission_bps, p.status, p.created_at, p.updated_at,
  p.category, p.attributes, p.region_uf,
  p.min_price_cents, p.commission_min_bps, p.commission_model, p.commission_tiers,
  p.review_status, p.trust_score, p.review_notes, p.reviewed_at, p.reviewed_by,
  -- IMEI propositalmente OMITIDO (dado sensivel; nao deve vazar na API publica).
  public.setting_int('platform_fee_bps', 500)::int as platform_fee_bps,
  public.resolve_commission_bps(p, p.amount_total_cents) as effective_commission_bps,
  floor(p.amount_total_cents * public.resolve_commission_bps(p, p.amount_total_cents) / 10000.0)::bigint as commission_cents,
  floor(p.amount_total_cents * public.setting_int('platform_fee_bps', 500) / 10000.0)::bigint as platform_fee_cents,
  (p.amount_total_cents
    - floor(p.amount_total_cents * public.resolve_commission_bps(p, p.amount_total_cents) / 10000.0)::bigint
    - floor(p.amount_total_cents * public.setting_int('platform_fee_bps', 500) / 10000.0)::bigint
  ) as seller_net_cents,
  coalesce(p.min_price_cents, p.amount_total_cents) as floor_price_cents,
  public.resolve_commission_bps(p, coalesce(p.min_price_cents, p.amount_total_cents)) as floor_commission_bps,
  floor(
    coalesce(p.min_price_cents, p.amount_total_cents)
    * public.resolve_commission_bps(p, coalesce(p.min_price_cents, p.amount_total_cents)) / 10000.0
  )::bigint as floor_commission_cents
from public.products p;

grant select on public.products_with_split to anon, authenticated;
