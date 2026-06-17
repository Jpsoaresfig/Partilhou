-- =============================================================================
-- 0012 — Endereco de entrega no pedido
-- =============================================================================
-- Um marketplace de bens fisicos precisa que o COMPRADOR informe onde receber e
-- que o VENDEDOR veja essa morada para despachar. O endereco e "fotografado"
-- (snapshot) no pedido no momento da compra, junto com o split — assim ele NAO
-- muda se o comprador editar o perfil depois, preservando integridade historica.
--
-- Guardamos como jsonb com formato validado (CHECK). E PII: a RLS de `orders`
-- (migration 0008) ja restringe a leitura ao comprador/vendedor/afiliado do
-- pedido; a camada de UI ainda esconde o endereco do afiliado.
-- =============================================================================

alter table public.orders
  add column if not exists shipping_address jsonb;

-- Validacao de forma: quando presente, exige os campos minimos para entrega.
alter table public.orders
  drop constraint if exists orders_shipping_address_shape;
alter table public.orders
  add constraint orders_shipping_address_shape check (
    shipping_address is null or (
      jsonb_typeof(shipping_address) = 'object'
      and coalesce(length(shipping_address->>'recipient'), 0) between 2 and 160
      and coalesce(length(shipping_address->>'zip'), 0)       between 8 and 9
      and coalesce(length(shipping_address->>'street'), 0)    between 2 and 200
      and coalesce(length(shipping_address->>'number'), 0)    between 1 and 20
      and coalesce(length(shipping_address->>'city'), 0)      between 2 and 120
      and coalesce(length(shipping_address->>'state'), 0)     = 2
    )
  );

-- -----------------------------------------------------------------------------
-- create_order: agora recebe o endereco de entrega (snapshot no pedido).
-- Substitui a versao de 3 argumentos por uma de 4 (4o parametro com default,
-- mantendo a compatibilidade com chamadas posicionais existentes — ex.: testes).
-- O endereco e OPCIONAL no banco (testes/seed podem omitir); a API o exige.
-- -----------------------------------------------------------------------------
drop function if exists app.create_order(uuid, uuid, text);

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
  v_platform_bps bigint := public.setting_int('platform_fee_bps', 500);
  v_commission   bigint;
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
  if v_product.seller_id = p_buyer_id then
    raise exception 'Voce nao pode comprar o proprio produto' using errcode = 'check_violation';
  end if;

  v_total := v_product.amount_total_cents;

  -- Resolve o afiliado a partir do codigo (ignora silenciosamente se invalido
  -- ou se for o proprio comprador/vendedor — vira venda direta).
  if p_affiliate_code is not null and length(trim(p_affiliate_code)) > 0 then
    select al.affiliate_id into v_affiliate_id
      from public.affiliate_links al
     where al.tracking_code = p_affiliate_code
       and al.product_id = p_product_id;

    if v_affiliate_id is not null
       and (v_affiliate_id = p_buyer_id or v_affiliate_id = v_product.seller_id) then
      v_affiliate_id := null;
    end if;
  end if;

  -- Calculo do split (centavos, inteiros). floor evita criar centavos do nada.
  v_platform_fee := floor(v_total * v_platform_bps / 10000.0)::bigint;
  if v_affiliate_id is not null then
    v_commission := floor(v_total * v_product.commission_bps / 10000.0)::bigint;
  else
    v_commission := 0; -- venda direta: sem comissao
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
    v_total, case when v_affiliate_id is not null then v_product.commission_bps else 0 end,
    v_platform_bps::int, v_commission, v_platform_fee, v_seller_net,
    'pendente', 'aguardando_envio', 'aguardando_pagamento',
    p_shipping
  )
  returning * into v_order;

  return v_order;
end;
$$;

-- O grant de execute para service_role e aplicado automaticamente pelas
-- "alter default privileges" da migration 0010 (vale para funcoes futuras em `app`).
