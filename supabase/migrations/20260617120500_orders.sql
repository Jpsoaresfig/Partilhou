-- =============================================================================
-- 0005 — Pedidos / Transacoes
-- =============================================================================
-- Os valores (preco, comissao, taxa) sao "fotografados" (snapshot) no momento da
-- compra. Se o vendedor mudar a comissao do anuncio depois, pedidos antigos NAO
-- sao afetados. Toda a aritmetica de split fica congelada no pedido.
-- =============================================================================

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products (id),
  -- Denormalizados (snapshot) para integridade historica:
  seller_id          uuid not null references public.profiles (id),
  buyer_id           uuid not null references public.profiles (id),
  affiliate_id       uuid references public.profiles (id),  -- nulo = venda direta

  -- Valores congelados, em centavos.
  amount_total_cents bigint not null check (amount_total_cents >= 100),
  commission_bps     integer not null check (commission_bps between 0 and 10000),
  platform_fee_bps   integer not null check (platform_fee_bps between 0 and 10000),
  commission_cents   bigint not null check (commission_cents >= 0),
  platform_fee_cents bigint not null check (platform_fee_cents >= 0),
  seller_net_cents   bigint not null check (seller_net_cents >= 0),

  -- Maquina de estados.
  payment_status     public.payment_status  not null default 'pendente',
  delivery_status    public.delivery_status not null default 'aguardando_envio',
  funds_state        public.funds_state     not null default 'aguardando_pagamento',

  -- Integracao com o gateway.
  payment_provider   text,
  provider_payment_id text,

  -- Logistica / escrow.
  tracking_code      text,
  shipped_at         timestamptz,
  delivered_at       timestamptz,
  auto_release_at    timestamptz,   -- quando o escrow libera sozinho
  dispute_reason     text,
  released_at        timestamptz,
  refunded_at        timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- A soma dos splits precisa fechar com o total. Garante consistencia aritmetica.
  constraint orders_split_sums check (
    commission_cents + platform_fee_cents + seller_net_cents = amount_total_cents
  ),
  -- Comprador nao compra o proprio produto; afiliado nao e o comprador nem vendedor.
  constraint orders_buyer_not_seller check (buyer_id <> seller_id),
  constraint orders_affiliate_distinct check (
    affiliate_id is null or (affiliate_id <> buyer_id and affiliate_id <> seller_id)
  )
);

create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_idx on public.orders (seller_id, created_at desc);
create index if not exists orders_affiliate_idx on public.orders (affiliate_id, created_at desc);
create index if not exists orders_product_idx on public.orders (product_id);
-- Para o job de liberacao automatica.
create index if not exists orders_auto_release_idx
  on public.orders (auto_release_at)
  where funds_state = 'retido';
-- Mapeia notificacoes do gateway -> pedido.
create index if not exists orders_provider_payment_idx
  on public.orders (payment_provider, provider_payment_id)
  where provider_payment_id is not null;

drop trigger if exists touch_orders on public.orders;
create trigger touch_orders before update on public.orders
  for each row execute function app.touch_updated_at();

-- Agora que orders existe, liga o ledger ao pedido.
alter table public.ledger_entries
  drop constraint if exists ledger_entries_order_fk;
alter table public.ledger_entries
  add constraint ledger_entries_order_fk
  foreign key (order_id) references public.orders (id) on delete restrict;

-- -----------------------------------------------------------------------------
-- Saques (payouts). Debitam saldo_disponivel e disparam transferencia externa.
-- -----------------------------------------------------------------------------
create table if not exists public.withdrawals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id),
  amount_cents bigint not null check (amount_cents > 0),
  status       public.withdrawal_status not null default 'solicitado',
  pix_key      text,
  provider_transfer_id text,
  failure_reason text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists withdrawals_user_idx on public.withdrawals (user_id, created_at desc);

drop trigger if exists touch_withdrawals on public.withdrawals;
create trigger touch_withdrawals before update on public.withdrawals
  for each row execute function app.touch_updated_at();
