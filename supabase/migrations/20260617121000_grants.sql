-- =============================================================================
-- 0010 — Grants explicitos (defesa em profundidade)
-- =============================================================================
-- A RLS controla QUAIS linhas; os grants controlam o ACESSO a tabela/funcao.
-- Tornamos explicito para nao depender de defaults que variam entre ambientes.
-- =============================================================================

-- Leitura publica dos objetos de catalogo (RLS ainda filtra as linhas).
grant usage on schema public to anon, authenticated;
grant select on public.products              to anon, authenticated;
grant select on public.products_with_split   to anon, authenticated;
grant select on public.platform_settings     to anon, authenticated;
grant execute on function public.setting_int(text, bigint) to anon, authenticated, service_role;

-- Escrita de catalogo por usuarios autenticados (RLS restringe ao dono).
grant select, insert, update, delete on public.products to authenticated;
-- Em profiles, o usuario so pode editar o nome (status/created_at sao protegidos).
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles_private to authenticated;
grant select, insert, update, delete on public.wallet_payout_methods to authenticated;

-- Apenas leitura do dono (RLS) nas tabelas financeiras.
grant select on public.orders          to authenticated;
grant select on public.wallets         to authenticated;
grant select on public.ledger_entries  to authenticated;
grant select on public.withdrawals     to authenticated;
grant select on public.affiliate_links to authenticated;

-- Tabelas SEM acesso de cliente (RLS sem policy ja nega; revogamos por garantia).
revoke all on public.payment_events  from anon, authenticated;
revoke all on public.affiliate_clicks from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Funcoes financeiras do schema `app`: executaveis SOMENTE pelo service_role.
-- anon/authenticated nem tem USAGE em `app` (migration 0000); ainda assim,
-- revogamos de PUBLIC e concedemos so ao service_role.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to service_role;

-- Garante o mesmo comportamento para funcoes criadas no futuro neste schema.
alter default privileges in schema app revoke execute on functions from public;
alter default privileges in schema app grant execute on functions to service_role;
