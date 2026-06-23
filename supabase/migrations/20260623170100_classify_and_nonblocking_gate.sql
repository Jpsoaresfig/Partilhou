-- =============================================================================
-- 0028 — Classificacao automatica (nao bloqueante) + gate de compra relaxado
-- =============================================================================
-- Modelo novo: a validacao classifica, nao barra. Consequencias:
--   * app.classify_product: grava o selo/score calculado na criacao (privilegiado;
--     o usuario nao escolhe o proprio selo). Respeita decisao manual de 'rejected'.
--   * app.create_order: deixa de exigir 'approved'/'partial'. So 'rejected'
--     (golpe/dados invalidos, marcado pelo admin) NAO pode gerar pedido.
--   * app.review_product: passa a aceitar tambem 'unverified' (override do admin).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) classify_product: escreve o selo/score automatico de um anuncio.
-- -----------------------------------------------------------------------------
create or replace function app.classify_product(
  p_product_id  uuid,
  p_status      text,
  p_trust_score int
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_score   int := greatest(0, least(100, coalesce(p_trust_score, 0)));
begin
  if p_status not in ('approved', 'partial', 'unverified') then
    raise exception 'Status de classificacao invalido: %', p_status
      using errcode = 'check_violation';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produto inexistente' using errcode = 'no_data_found';
  end if;

  -- Respeita a decisao humana: nao reclassifica automaticamente um anuncio ja
  -- moderado por um admin (reviewed_by set) nem um rejeitado (anti-fraude). So
  -- sai dessas situacoes por app.review_product. Mantem coerencia com o flag
  -- `applied` da rota /api/products/validate, que assume este mesmo guard.
  if v_product.reviewed_by is not null or v_product.review_status = 'rejected' then
    return v_product;
  end if;

  update public.products
     set review_status = p_status::public.review_status,
         trust_score   = v_score
   where id = p_product_id
  returning * into v_product;

  return v_product;
end;
$$;

comment on function app.classify_product is
  'Classificacao automatica nao-bloqueante (approved|partial|unverified). Respeita rejected manual.';

revoke execute on function app.classify_product(uuid, text, integer) from public;
grant execute on function app.classify_product(uuid, text, integer) to service_role;

-- -----------------------------------------------------------------------------
-- 2) review_product: aceita 'unverified' (override manual do admin).
-- -----------------------------------------------------------------------------
create or replace function app.review_product(
  p_product_id  uuid,
  p_decision    text,
  p_trust_score int,
  p_notes       text default null,
  p_reviewer    uuid default null
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_score   int := greatest(0, least(100, coalesce(p_trust_score, 0)));
begin
  if p_decision not in ('approved', 'partial', 'unverified', 'rejected') then
    raise exception 'Decisao invalida: % (use approved|partial|unverified|rejected)', p_decision
      using errcode = 'check_violation';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produto inexistente' using errcode = 'no_data_found';
  end if;

  update public.products
     set review_status = p_decision::public.review_status,
         trust_score   = case when p_decision = 'rejected' then 0 else v_score end,
         review_notes  = left(p_notes, 2000),
         reviewed_at   = now(),
         reviewed_by   = p_reviewer,
         -- 'rejected' tira o anuncio do ar; reabilitar volta para 'ativo'.
         status        = case
                           when p_decision = 'rejected' then 'pausado'::public.product_status
                           when v_product.status = 'pausado' then 'ativo'::public.product_status
                           else v_product.status
                         end
   where id = p_product_id
  returning * into v_product;

  return v_product;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) create_order: gate NAO bloqueante. So 'rejected' impede a compra.
--    (Recriada identica a 0026, trocando a condicao do gate de validacao.)
-- -----------------------------------------------------------------------------
create or replace function app.create_order(
  p_buyer_id        uuid,
  p_product_id      uuid,
  p_affiliate_code  text  default null,
  p_shipping        jsonb default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product      public.products;
  v_order        public.orders;
  v_affiliate_id uuid;
  v_sale_price   bigint;
  v_platform_bps bigint := public.setting_int('platform_fee_bps', 500);
  v_commission   bigint;
  v_commission_bps integer;
  v_platform_fee bigint;
  v_seller_net   bigint;
  v_total        bigint;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produto inexistente' using errcode = 'no_data_found';
  end if;
  if v_product.status <> 'ativo' then
    raise exception 'Produto indisponivel para compra' using errcode = 'check_violation';
  end if;
  -- GATE NAO BLOQUEANTE: validacao classifica, nao barra. So produto REPROVADO
  -- (golpe/dados invalidos, marcado pelo admin) nao pode gerar pedido.
  if v_product.review_status = 'rejected' then
    raise exception 'Produto reprovado na validacao' using errcode = 'check_violation';
  end if;
  if v_product.seller_id = p_buyer_id then
    raise exception 'Voce nao pode comprar o proprio produto' using errcode = 'check_violation';
  end if;

  -- Resolve o afiliado a partir do codigo (ignora silenciosamente se invalido
  -- ou se for o proprio comprador/vendedor — vira venda direta). Captura tambem
  -- o preco escolhido pelo afiliado.
  if p_affiliate_code is not null and length(trim(p_affiliate_code)) > 0 then
    select al.affiliate_id, al.sale_price_cents
      into v_affiliate_id, v_sale_price
      from public.affiliate_links al
     where al.tracking_code = p_affiliate_code
       and al.product_id = p_product_id;

    if v_affiliate_id is not null
       and (v_affiliate_id = p_buyer_id or v_affiliate_id = v_product.seller_id) then
      v_affiliate_id := null;
      v_sale_price   := null;
    end if;
  end if;

  if v_affiliate_id is not null then
    v_total := public.affiliate_effective_price(v_product, v_sale_price);
  else
    v_total := v_product.amount_total_cents;
  end if;

  v_platform_fee := floor(v_total * v_platform_bps / 10000.0)::bigint;
  if v_affiliate_id is not null then
    v_commission_bps := public.resolve_commission_bps(v_product, v_total);
    v_commission := floor(v_total * v_commission_bps / 10000.0)::bigint;
  else
    v_commission_bps := 0;
    v_commission := 0;
  end if;
  v_seller_net := v_total - v_commission - v_platform_fee;

  if v_seller_net < 0 then
    raise exception 'Configuracao invalida: comissao + taxa excedem o valor total'
      using errcode = 'check_violation';
  end if;

  insert into public.orders (
    product_id, seller_id, buyer_id, affiliate_id,
    amount_total_cents, commission_bps, platform_fee_bps,
    commission_cents, platform_fee_cents, seller_net_cents,
    payment_status, delivery_status, funds_state,
    shipping_address
  ) values (
    v_product.id, v_product.seller_id, p_buyer_id, v_affiliate_id,
    v_total, v_commission_bps,
    v_platform_bps::int, v_commission, v_platform_fee, v_seller_net,
    'pendente', 'aguardando_envio', 'aguardando_pagamento',
    p_shipping
  )
  returning * into v_order;

  return v_order;
end;
$$;
