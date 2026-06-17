-- =============================================================================
-- 0008 — Row Level Security (RLS)
-- =============================================================================
-- Regras de ouro aplicadas (checklist Supabase):
--   * RLS habilitada em TODA tabela do schema public.
--   * Sempre `TO authenticated` + predicado de posse (evita IDOR/BOLA).
--   * UPDATE com USING e WITH CHECK.
--   * (select auth.uid()) em vez de auth.uid() por performance (cacheado).
--   * Tabelas financeiras NAO sao escritas por clientes: somente leitura do dono.
--     A escrita acontece via funcoes SECURITY DEFINER (schema app), chamadas
--     pelo backend com service_role.
-- =============================================================================

-- --- profiles ----------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);  -- nomes de vendedores sao publicos

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- O usuario nao pode alterar o proprio status da conta (apenas admin/service).
revoke update (account_status) on public.profiles from authenticated;

-- --- profiles_private (PII) --------------------------------------------------
alter table public.profiles_private enable row level security;

drop policy if exists profiles_private_rw_own on public.profiles_private;
create policy profiles_private_rw_own on public.profiles_private
  for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

-- --- products ----------------------------------------------------------------
alter table public.products enable row level security;

-- Qualquer um (inclusive nao logado) ve anuncios ativos; o dono ve os seus.
drop policy if exists products_select_public on public.products;
create policy products_select_public on public.products
  for select to anon, authenticated
  using (status = 'ativo' or (select auth.uid()) = seller_id);

drop policy if exists products_insert_own on public.products;
create policy products_insert_own on public.products
  for insert to authenticated
  with check ((select auth.uid()) = seller_id);

drop policy if exists products_update_own on public.products;
create policy products_update_own on public.products
  for update to authenticated
  using ((select auth.uid()) = seller_id)
  with check ((select auth.uid()) = seller_id);

drop policy if exists products_delete_own on public.products;
create policy products_delete_own on public.products
  for delete to authenticated
  using ((select auth.uid()) = seller_id);

-- --- affiliate_links ---------------------------------------------------------
alter table public.affiliate_links enable row level security;

-- O afiliado ve os proprios links; criacao e via RPC app.create_affiliate_link.
drop policy if exists affiliate_links_select_own on public.affiliate_links;
create policy affiliate_links_select_own on public.affiliate_links
  for select to authenticated
  using ((select auth.uid()) = affiliate_id);

-- --- affiliate_clicks (sem acesso a clientes) --------------------------------
alter table public.affiliate_clicks enable row level security;
-- Nenhuma policy => negado para anon/authenticated. service_role faz bypass.

-- --- wallets -----------------------------------------------------------------
alter table public.wallets enable row level security;

drop policy if exists wallets_select_own on public.wallets;
create policy wallets_select_own on public.wallets
  for select to authenticated
  using ((select auth.uid()) = user_id);
-- Sem policy de write: saldos so mudam via funcoes financeiras.

-- --- wallet_payout_methods ---------------------------------------------------
alter table public.wallet_payout_methods enable row level security;

drop policy if exists payout_methods_rw_own on public.wallet_payout_methods;
create policy payout_methods_rw_own on public.wallet_payout_methods
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --- ledger_entries (somente leitura do dono) --------------------------------
alter table public.ledger_entries enable row level security;

drop policy if exists ledger_select_own on public.ledger_entries;
create policy ledger_select_own on public.ledger_entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- --- orders (somente leitura dos envolvidos) ---------------------------------
alter table public.orders enable row level security;

drop policy if exists orders_select_involved on public.orders;
create policy orders_select_involved on public.orders
  for select to authenticated
  using (
    (select auth.uid()) in (buyer_id, seller_id)
    or (affiliate_id is not null and (select auth.uid()) = affiliate_id)
  );
-- Sem write por cliente: criacao/transicoes via funcoes financeiras.

-- --- withdrawals (somente leitura do dono) -----------------------------------
alter table public.withdrawals enable row level security;

drop policy if exists withdrawals_select_own on public.withdrawals;
create policy withdrawals_select_own on public.withdrawals
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- --- payment_events (sem acesso a clientes) ----------------------------------
alter table public.payment_events enable row level security;
-- Nenhuma policy => negado. Apenas service_role/funcoes acessam.
