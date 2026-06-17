-- =============================================================================
-- 0004 — Carteiras digitais + Razao (ledger) de partidas dobradas
-- =============================================================================
-- Modelo de integridade financeira:
--   * Cada usuario possui UMA carteira (saldo_pendente / saldo_disponivel).
--   * Toda movimentacao gera lancamentos no ledger agrupados por `entry_group`.
--   * INVARIANTE: a soma de `amount_cents` (com sinal) de cada `entry_group` = 0.
--     Isso e validado por trigger diferido (no commit da transacao).
--   * Saldos das carteiras sao PROJECOES do ledger e atualizados na mesma
--     transacao que cria os lancamentos. A funcao app.reconcile_wallet()
--     permite reauditar saldo vs. ledger a qualquer momento.
-- =============================================================================

create table if not exists public.wallets (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique
                             references public.profiles (id) on delete cascade,
  balance_pending_cents    bigint not null default 0 check (balance_pending_cents >= 0),
  balance_available_cents  bigint not null default 0 check (balance_available_cents >= 0),
  currency                 text not null default 'BRL',
  updated_at               timestamptz not null default now()
);

create index if not exists wallets_user_idx on public.wallets (user_id);

drop trigger if exists touch_wallets on public.wallets;
create trigger touch_wallets before update on public.wallets
  for each row execute function app.touch_updated_at();

-- Dados bancarios para saque, isolados e com RLS estrita (apenas dono/service).
-- Recomenda-se criptografia em nivel de coluna via Supabase Vault em producao.
create table if not exists public.wallet_payout_methods (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  pix_key    text,
  bank_data  jsonb,   -- conta/agencia se nao for PIX
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_payout_methods on public.wallet_payout_methods;
create trigger touch_payout_methods before update on public.wallet_payout_methods
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Razao (append-only). Nunca se faz UPDATE/DELETE em lancamentos: correcoes
-- sao feitas por novos lancamentos de 'ajuste'.
-- -----------------------------------------------------------------------------
create table if not exists public.ledger_entries (
  id           bigint generated always as identity primary key,
  entry_group  uuid not null,                 -- agrupa os lados da mesma transacao
  type         public.ledger_type not null,
  account      public.ledger_account not null,
  -- Usuario dono do lado (null para contas externas/plataforma sem usuario).
  user_id      uuid references public.profiles (id) on delete set null,
  order_id     uuid,                           -- FK adicionada na migration 0005
  amount_cents bigint not null,                -- COM sinal: + credito, - debito
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists ledger_group_idx on public.ledger_entries (entry_group);
create index if not exists ledger_user_idx on public.ledger_entries (user_id, created_at desc);
create index if not exists ledger_order_idx on public.ledger_entries (order_id);

-- Bloqueia mutacao do ledger (append-only).
create or replace function app.ledger_is_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'O ledger e append-only: % nao permitido', tg_op
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists ledger_no_update on public.ledger_entries;
create trigger ledger_no_update before update or delete on public.ledger_entries
  for each row execute function app.ledger_is_append_only();

-- -----------------------------------------------------------------------------
-- INVARIANTE de partidas dobradas: cada entry_group precisa somar zero.
-- Implementado como CONSTRAINT TRIGGER DEFERRED, validado no COMMIT — assim os
-- dois lados podem ser inseridos em qualquer ordem dentro da transacao.
-- -----------------------------------------------------------------------------
create or replace function app.assert_ledger_balanced()
returns trigger
language plpgsql
as $$
declare
  v_sum bigint;
begin
  select coalesce(sum(amount_cents), 0) into v_sum
    from public.ledger_entries
   where entry_group = new.entry_group;

  if v_sum <> 0 then
    raise exception
      'Lancamento desbalanceado no grupo % (soma = % centavos)', new.entry_group, v_sum
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

drop trigger if exists ledger_balanced on public.ledger_entries;
create constraint trigger ledger_balanced
  after insert on public.ledger_entries
  deferrable initially deferred
  for each row execute function app.assert_ledger_balanced();

-- -----------------------------------------------------------------------------
-- Helpers internos de movimentacao de carteira (usados pelas funcoes 0007).
-- Aplicam o lock de linha e mantem o saldo >= 0.
-- -----------------------------------------------------------------------------
create or replace function app.move_pending(p_user uuid, p_delta bigint)
returns void
language plpgsql
as $$
begin
  update public.wallets
     set balance_pending_cents = balance_pending_cents + p_delta
   where user_id = p_user;
  if not found then
    raise exception 'Carteira do usuario % inexistente', p_user
      using errcode = 'no_data_found';
  end if;
end;
$$;

create or replace function app.move_available(p_user uuid, p_delta bigint)
returns void
language plpgsql
as $$
begin
  update public.wallets
     set balance_available_cents = balance_available_cents + p_delta
   where user_id = p_user;
  if not found then
    raise exception 'Carteira do usuario % inexistente', p_user
      using errcode = 'no_data_found';
  end if;
end;
$$;

-- Reauditoria: confere se os saldos batem com a projecao do ledger.
create or replace function app.reconcile_wallet(p_user uuid)
returns table (
  pending_wallet   bigint,
  pending_ledger   bigint,
  available_wallet bigint,
  available_ledger bigint,
  ok               boolean
)
language sql
stable
as $$
  with w as (
    select balance_pending_cents, balance_available_cents
      from public.wallets where user_id = p_user
  ),
  l as (
    select
      coalesce(sum(amount_cents) filter (where account = 'usuario_pendente'), 0) as pending,
      coalesce(sum(amount_cents) filter (where account = 'usuario_disponivel'), 0) as available
    from public.ledger_entries where user_id = p_user
  )
  select
    w.balance_pending_cents, l.pending,
    w.balance_available_cents, l.available,
    (w.balance_pending_cents = l.pending and w.balance_available_cents = l.available)
  from w, l;
$$;
