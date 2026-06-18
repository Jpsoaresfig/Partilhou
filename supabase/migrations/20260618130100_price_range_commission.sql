-- =============================================================================
-- 0014 — Faixa de preco + comissao de afiliado variavel
-- =============================================================================
-- O vendedor deixa de definir UM preco fixo e passa a definir uma FAIXA:
--   * amount_total_cents  -> preco-ALVO/desejado (teto; o que um comprador direto paga)
--   * min_price_cents     -> PISO (menor valor que o vendedor aceita)
-- O afiliado escolhe por quanto vende dentro de [min, alvo] (sale_price_cents no
-- link). Quanto mais caro vender, MAIOR a % de comissao dele. Dois modelos:
--   * linear : interpola entre commission_min_bps (no piso) e commission_bps (no alvo)
--   * tiers  : degraus fixos [{min_price_cents, bps}] definidos pelo vendedor
--
-- TUDO e aditivo e retrocompativel: as colunas novas sao nullable/com default,
-- entao produtos existentes (min nulo, model 'linear', sem min_bps) continuam
-- com comissao constante = commission_bps, exatamente como antes. Seed e testes
-- de escrow que nao informam os campos novos seguem funcionando.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Novas colunas em products.
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists min_price_cents    bigint,
  add column if not exists commission_min_bps integer,
  add column if not exists commission_model   text not null default 'linear',
  add column if not exists commission_tiers   jsonb;

-- Piso, quando informado, fica entre 100 e o preco-alvo.
alter table public.products
  drop constraint if exists products_min_price_range;
alter table public.products
  add constraint products_min_price_range check (
    min_price_cents is null
    or (min_price_cents >= 100 and min_price_cents <= amount_total_cents)
  );

-- Comissao no piso, quando informada, respeita o intervalo de bps.
alter table public.products
  drop constraint if exists products_commission_min_bps_range;
alter table public.products
  add constraint products_commission_min_bps_range check (
    commission_min_bps is null or (commission_min_bps between 0 and 10000)
  );

alter table public.products
  drop constraint if exists products_commission_model_chk;
alter table public.products
  add constraint products_commission_model_chk
  check (commission_model in ('linear', 'tiers'));

-- Forma dos tiers: array com 1..12 itens. A validacao por elemento (objeto com
-- min_price_cents/bps numericos e dentro dos limites) fica na trigger abaixo —
-- CHECK constraint nao aceita subquery (necessaria para varrer o array).
alter table public.products
  drop constraint if exists products_commission_tiers_shape;
alter table public.products
  add constraint products_commission_tiers_shape check (
    commission_tiers is null or (
      jsonb_typeof(commission_tiers) = 'array'
      and jsonb_array_length(commission_tiers) between 1 and 12
    )
  );

-- Quando o modelo e 'tiers', os degraus sao obrigatorios.
alter table public.products
  drop constraint if exists products_tiers_required;
alter table public.products
  add constraint products_tiers_required check (
    commission_model <> 'tiers' or commission_tiers is not null
  );

-- -----------------------------------------------------------------------------
-- 2) Preco escolhido pelo afiliado (por link). Nulo = vende pelo preco-alvo.
--    A faixa valida e validada no momento da escrita (funcao abaixo) e tambem
--    "clampada" na create_order, defendendo contra dados antigos/fora da faixa.
-- -----------------------------------------------------------------------------
alter table public.affiliate_links
  add column if not exists sale_price_cents bigint;

alter table public.affiliate_links
  drop constraint if exists affiliate_links_sale_price_positive;
alter table public.affiliate_links
  add constraint affiliate_links_sale_price_positive check (
    sale_price_cents is null or sale_price_cents >= 100
  );

-- -----------------------------------------------------------------------------
-- 3) Fonte da verdade da comissao: resolve a % (bps) para um preco de venda.
--    IMMUTABLE puro: depende so do produto e do preco. Espelhada em
--    src/lib/money.ts (resolveCommissionBps) para a simulacao da UI bater.
--    Mora em `public` (e nao em `app`) porque a view products_with_split, que e
--    security_invoker, precisa chama-la como anon/authenticated.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_commission_bps(
  p_product    public.products,
  p_sale_price bigint
)
returns integer
language plpgsql
immutable
as $$
declare
  v_min_bps   integer;
  v_max_bps   integer;
  v_floor     bigint;
  v_target    bigint;
  v_price     bigint;
  v_bps       integer;
begin
  if p_product.commission_model = 'tiers' and p_product.commission_tiers is not null then
    -- Degrau aplicavel: o de maior min_price_cents que nao excede o preco de venda.
    select (t->>'bps')::int into v_bps
      from jsonb_array_elements(p_product.commission_tiers) t
     where (t->>'min_price_cents')::bigint <= p_sale_price
     order by (t->>'min_price_cents')::bigint desc
     limit 1;
    -- Preco abaixo do primeiro degrau: usa o degrau mais baixo.
    if v_bps is null then
      select (t->>'bps')::int into v_bps
        from jsonb_array_elements(p_product.commission_tiers) t
       order by (t->>'min_price_cents')::bigint asc
       limit 1;
    end if;
    return greatest(0, least(10000, coalesce(v_bps, 0)));
  end if;

  -- Modelo linear (padrao). Interpola entre o piso e o alvo.
  v_max_bps := p_product.commission_bps;
  v_min_bps := coalesce(p_product.commission_min_bps, p_product.commission_bps);
  v_floor   := coalesce(p_product.min_price_cents, p_product.amount_total_cents);
  v_target  := p_product.amount_total_cents;

  -- Sem faixa (piso == alvo) ou faixa degenerada: comissao constante (= alvo).
  if v_target <= v_floor then
    return greatest(0, least(10000, v_max_bps));
  end if;

  v_price := greatest(v_floor, least(v_target, p_sale_price));
  v_bps := round(
    v_min_bps + (v_price - v_floor)::numeric / (v_target - v_floor) * (v_max_bps - v_min_bps)
  )::int;

  return greatest(0, least(10000, v_bps));
end;
$$;

-- Preco efetivo de venda de um afiliado para um produto: o escolhido (clampado a
-- faixa) ou o preco-alvo quando nao definido. Tambem em `public` (usada na UI/SSR
-- e por create_order com search_path vazio).
create or replace function public.affiliate_effective_price(
  p_product   public.products,
  p_sale_price bigint
)
returns bigint
language sql
immutable
as $$
  select greatest(
    coalesce(p_product.min_price_cents, p_product.amount_total_cents),
    least(
      p_product.amount_total_cents,
      coalesce(p_sale_price, p_product.amount_total_cents)
    )
  );
$$;

-- Pura/somente-leitura: liberada para todos os papeis (como public.setting_int).
grant execute on function public.resolve_commission_bps(public.products, bigint)
  to anon, authenticated, service_role;
grant execute on function public.affiliate_effective_price(public.products, bigint)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) Validacao na escrita do produto: piso<=alvo, comissoes dentro dos limites
--    globais e (para tiers) cada degrau dentro dos limites e dentro da faixa.
--    Substitui a validate_product_commission e amplia os gatilhos de colunas.
-- -----------------------------------------------------------------------------
create or replace function app.validate_product_commission()
returns trigger
language plpgsql
as $$
declare
  v_min bigint := public.setting_int('min_commission_bps', 0);
  v_max bigint := public.setting_int('max_commission_bps', 5000);
  v_floor bigint := coalesce(new.min_price_cents, new.amount_total_cents);
  v_tier_bps bigint;
  v_tier_price bigint;
begin
  -- Comissao no alvo.
  if new.commission_bps < v_min or new.commission_bps > v_max then
    raise exception
      'Comissao % bps fora dos limites permitidos (% a % bps)',
      new.commission_bps, v_min, v_max
      using errcode = 'check_violation';
  end if;

  -- Comissao no piso (linear), quando informada.
  if new.commission_min_bps is not null
     and (new.commission_min_bps < v_min or new.commission_min_bps > v_max) then
    raise exception
      'Comissao minima % bps fora dos limites permitidos (% a % bps)',
      new.commission_min_bps, v_min, v_max
      using errcode = 'check_violation';
  end if;

  -- Tiers: cada degrau e um objeto {min_price_cents, bps} numerico, dentro dos
  -- limites de comissao e com preco dentro da faixa do produto.
  if new.commission_model = 'tiers' and new.commission_tiers is not null then
    for v_tier_bps, v_tier_price in
      select (t->>'bps')::bigint, (t->>'min_price_cents')::bigint
        from jsonb_array_elements(new.commission_tiers) t
    loop
      if v_tier_bps is null or v_tier_price is null then
        raise exception 'Degrau de comissao invalido: exige min_price_cents e bps numericos'
          using errcode = 'check_violation';
      end if;
      if v_tier_bps < v_min or v_tier_bps > v_max then
        raise exception
          'Comissao de degrau % bps fora dos limites permitidos (% a % bps)',
          v_tier_bps, v_min, v_max
          using errcode = 'check_violation';
      end if;
      if v_tier_price < v_floor or v_tier_price > new.amount_total_cents then
        raise exception
          'Degrau com preco % fora da faixa permitida (% a %)',
          v_tier_price, v_floor, new.amount_total_cents
          using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_product_commission on public.products;
create trigger validate_product_commission
  before insert or update of
    commission_bps, commission_min_bps, commission_model, commission_tiers,
    min_price_cents, amount_total_cents
  on public.products
  for each row execute function app.validate_product_commission();

-- -----------------------------------------------------------------------------
-- 5) Define (e cria, se preciso) o preco de venda de um afiliado para um produto.
--    Idempotente como create_affiliate_link; valida a faixa do produto.
--    p_sale_price nulo => volta a vender pelo preco-alvo.
-- -----------------------------------------------------------------------------
create or replace function app.set_affiliate_sale_price(
  p_affiliate_id uuid,
  p_product_id   uuid,
  p_sale_price   bigint default null
)
returns public.affiliate_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_link    public.affiliate_links;
  v_floor   bigint;
begin
  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'Produto inexistente' using errcode = 'no_data_found';
  end if;
  if v_product.status <> 'ativo' then
    raise exception 'Produto nao esta ativo' using errcode = 'check_violation';
  end if;
  if v_product.seller_id = p_affiliate_id then
    raise exception 'Vendedor nao pode se afiliar ao proprio produto'
      using errcode = 'check_violation';
  end if;

  v_floor := coalesce(v_product.min_price_cents, v_product.amount_total_cents);
  if p_sale_price is not null
     and (p_sale_price < v_floor or p_sale_price > v_product.amount_total_cents) then
    raise exception 'Preco % fora da faixa permitida (% a %)',
      p_sale_price, v_floor, v_product.amount_total_cents
      using errcode = 'check_violation';
  end if;

  -- Reaproveita link existente; caso contrario gera codigo unico (idempotente).
  loop
    update public.affiliate_links
       set sale_price_cents = p_sale_price
     where affiliate_id = p_affiliate_id and product_id = p_product_id
    returning * into v_link;
    if found then
      exit;
    end if;
    begin
      insert into public.affiliate_links (affiliate_id, product_id, tracking_code, sale_price_cents)
      values (
        p_affiliate_id, p_product_id,
        substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
        p_sale_price
      )
      returning * into v_link;
      exit;
    exception when unique_violation then
      -- Corrida no par (affiliate, product) ou colisao de codigo: retenta o update.
      continue;
    end;
  end loop;

  return v_link;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) create_order: resolve o preco efetivo do afiliado e a comissao variavel.
--    Mantem a assinatura de 4 argumentos (compat. com checkout/testes).
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
  if v_product.seller_id = p_buyer_id then
    raise exception 'Voce nao pode comprar o proprio produto' using errcode = 'check_violation';
  end if;

  -- Resolve o afiliado a partir do codigo (ignora silenciosamente se invalido
  -- ou se for o proprio comprador/vendedor — vira venda direta). Tambem captura
  -- o preco que o afiliado escolheu para esta venda.
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

  -- Preco cobrado do comprador: venda por afiliado usa o preco escolhido (clampado
  -- a faixa); venda direta usa sempre o preco-alvo.
  if v_affiliate_id is not null then
    v_total := public.affiliate_effective_price(v_product, v_sale_price);
  else
    v_total := v_product.amount_total_cents;
  end if;

  -- Split (centavos, inteiros). floor evita criar centavos do nada.
  v_platform_fee := floor(v_total * v_platform_bps / 10000.0)::bigint;
  if v_affiliate_id is not null then
    v_commission_bps := public.resolve_commission_bps(v_product, v_total);
    v_commission := floor(v_total * v_commission_bps / 10000.0)::bigint;
  else
    v_commission_bps := 0;
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
    v_total, v_commission_bps,
    v_platform_bps::int, v_commission, v_platform_fee, v_seller_net,
    'pendente', 'aguardando_envio', 'aguardando_pagamento',
    p_shipping
  )
  returning * into v_order;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) View publica com a simulacao do split. Recriada (drop+create) para expor
--    as colunas novas e calcular a comissao no piso e no alvo via resolve.
-- -----------------------------------------------------------------------------
drop view if exists public.products_with_split;

create view public.products_with_split
with (security_invoker = true) as
select
  p.*,
  public.setting_int('platform_fee_bps', 500)::int as platform_fee_bps,
  -- Comissao/efeitos calculados no PRECO-ALVO (preco padrao exibido).
  public.resolve_commission_bps(p, p.amount_total_cents) as effective_commission_bps,
  floor(p.amount_total_cents * public.resolve_commission_bps(p, p.amount_total_cents) / 10000.0)::bigint as commission_cents,
  floor(p.amount_total_cents * public.setting_int('platform_fee_bps', 500) / 10000.0)::bigint as platform_fee_cents,
  (p.amount_total_cents
    - floor(p.amount_total_cents * public.resolve_commission_bps(p, p.amount_total_cents) / 10000.0)::bigint
    - floor(p.amount_total_cents * public.setting_int('platform_fee_bps', 500) / 10000.0)::bigint
  ) as seller_net_cents,
  -- Comissao no PISO (extremo inferior da faixa), util para mostrar o intervalo.
  coalesce(p.min_price_cents, p.amount_total_cents) as floor_price_cents,
  public.resolve_commission_bps(p, coalesce(p.min_price_cents, p.amount_total_cents)) as floor_commission_bps,
  floor(
    coalesce(p.min_price_cents, p.amount_total_cents)
    * public.resolve_commission_bps(p, coalesce(p.min_price_cents, p.amount_total_cents)) / 10000.0
  )::bigint as floor_commission_cents
from public.products p;

-- Recriar a view zera os grants; reaplicamos a leitura publica.
grant select on public.products_with_split to anon, authenticated;
