-- =============================================================================
-- 0000 — Extensoes, schema privado `app`, tipos (enums) e configuracoes
-- =============================================================================
-- Principios de robustez adotados em todo o schema:
--   * Dinheiro SEMPRE em centavos (bigint). Nunca float/double. Sem erros de
--     arredondamento binario.
--   * Percentuais em "basis points" (bps): 1500 = 15,00%. Inteiro, exato.
--   * Toda movimentacao financeira passa por funcoes PL/pgSQL atomicas
--     (transacao implicita) com locks de linha (FOR UPDATE).
--   * Razao (ledger) de partidas dobradas: a soma de cada grupo de lancamentos
--     e sempre ZERO. Saldos das carteiras sao projecoes verificaveis do ledger.
--   * Idempotencia garantida por chave unica de evento + guarda de estado.
-- =============================================================================

-- gen_random_uuid() e core (pg_catalog) no PG13+. Mantemos pgcrypto disponivel
-- para uso futuro (HMAC/cifragem), mas o schema NAO depende dele em runtime.
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";        -- liberacao automatica de saldo
-- pg_cron pode exigir habilitacao no painel (Database > Extensions). Caso o
-- ambiente local nao tenha, a migration 0009 trata a ausencia com aviso.

-- Schema privado. NAO exposto via Data API (PostgREST). Guarda as funcoes
-- SECURITY DEFINER que movem dinheiro, para que nao virem endpoints publicos.
create schema if not exists app;

revoke all on schema app from public, anon, authenticated;
grant usage on schema app to service_role;

-- -----------------------------------------------------------------------------
-- Tipos (enums)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum (
      'pendente_verificacao', 'ativa', 'suspensa'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'product_status') then
    create type public.product_status as enum (
      'ativo', 'pausado', 'vendido', 'excluido'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'pendente', 'aprovado', 'em_disputa', 'estornado', 'concluido'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'delivery_status') then
    create type public.delivery_status as enum (
      'aguardando_envio', 'em_transito', 'entregue'
    );
  end if;

  -- Estado dos fundos dentro do escrow. Chave para idempotencia/seguranca.
  if not exists (select 1 from pg_type where typname = 'funds_state') then
    create type public.funds_state as enum (
      'aguardando_pagamento', -- pedido criado, dinheiro ainda nao capturado
      'retido',               -- pago e retido (saldo_pendente das carteiras)
      'liberado',             -- repassado (saldo_disponivel)
      'estornado'             -- devolvido ao comprador
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'ledger_account') then
    -- Contas agnosticas de papel: a carteira de cada usuario e unificada
    -- (pendente/disponivel). Se o usuario foi vendedor ou afiliado naquele
    -- lancamento fica registrado em ledger_entries.metadata->>'role'.
    create type public.ledger_account as enum (
      'externo',                                    -- mundo externo (comprador entra, saque sai)
      'usuario_pendente', 'usuario_disponivel',     -- carteira de um usuario
      'plataforma_pendente', 'plataforma_disponivel'-- receita da plataforma
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'ledger_type') then
    create type public.ledger_type as enum (
      'captura', 'liberacao', 'estorno', 'saque', 'ajuste'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'withdrawal_status') then
    create type public.withdrawal_status as enum (
      'solicitado', 'processando', 'pago', 'falhou', 'cancelado'
    );
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- Configuracoes da plataforma (tunaveis sem deploy)
-- -----------------------------------------------------------------------------
create table if not exists public.platform_settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into public.platform_settings (key, value, description) values
  ('platform_fee_bps',        '500',  'Taxa da plataforma em basis points (500 = 5,00%).'),
  ('min_commission_bps',      '0',    'Comissao minima de afiliado permitida (bps).'),
  ('max_commission_bps',      '5000', 'Comissao maxima de afiliado permitida (5000 = 50,00%).'),
  ('escrow_auto_release_days','7',    'Dias apos envio para liberar fundos automaticamente.'),
  ('affiliate_cookie_days',   '30',   'Validade (dias) do cookie de atribuicao do afiliado.')
on conflict (key) do nothing;

-- RLS: leitura publica das configuracoes (sao parametros, nao segredos).
alter table public.platform_settings enable row level security;

drop policy if exists "settings_select_all" on public.platform_settings;
create policy "settings_select_all" on public.platform_settings
  for select to anon, authenticated using (true);
-- Escrita apenas via service_role (bypass de RLS). Nenhuma policy de write.

-- Helper: le uma configuracao numerica com fallback.
-- Fica em `public` (nao em `app`) porque tambem e chamado por triggers/views que
-- rodam no contexto do usuario (authenticated/anon), os quais NAO tem USAGE em
-- `app`. Como platform_settings e legivel por todos (parametros, nao segredos),
-- SECURITY INVOKER e suficiente e seguro.
create or replace function public.setting_int(p_key text, p_default bigint)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select value::bigint from public.platform_settings where key = p_key),
    p_default
  );
$$;

comment on schema app is 'Schema privado: funcoes financeiras SECURITY DEFINER. Nao exposto via API.';
