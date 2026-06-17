-- =============================================================================
-- Teste de fluxo financeiro ponta-a-ponta (rode com: psql < este arquivo)
-- Roda dentro de uma transacao e faz ROLLBACK no final (nao suja o banco).
-- Falha com EXCEPTION se qualquer assercao nao bater.
-- =============================================================================
begin;

do $$
declare
  v_seller   uuid := gen_random_uuid();
  v_buyer    uuid := gen_random_uuid();
  v_affiliate uuid := gen_random_uuid();
  v_product  public.products;
  v_link     public.affiliate_links;
  v_order    public.orders;
  v_seller_wallet public.wallets;
  v_aff_wallet    public.wallets;
  v_ledger_sum bigint;
begin
  -- --- Setup: cria 3 usuarios (a trigger cria profile + carteira). -----------
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (v_seller, 'vendedor@test.local', '{"full_name":"Vendedor"}'),
    (v_buyer, 'comprador@test.local', '{"full_name":"Comprador"}'),
    (v_affiliate, 'afiliado@test.local', '{"full_name":"Afiliado"}');

  -- Produto de R$ 100,00 com 15% de comissao.
  insert into public.products (seller_id, title, amount_total_cents, commission_bps)
  values (v_seller, 'Cadeira usada', 10000, 1500)
  returning * into v_product;

  -- Afiliado gera link.
  v_link := app.create_affiliate_link(v_affiliate, v_product.id);

  -- --- 1) Comprador cria pedido pelo link do afiliado. -----------------------
  v_order := app.create_order(v_buyer, v_product.id, v_link.tracking_code);

  assert v_order.affiliate_id = v_affiliate, 'afiliado deveria estar atribuido';
  assert v_order.commission_cents = 1500, 'comissao deveria ser 1500';
  assert v_order.platform_fee_cents = 500, 'taxa plataforma deveria ser 500 (5%)';
  assert v_order.seller_net_cents = 8000, 'liquido vendedor deveria ser 8000';
  assert v_order.funds_state = 'aguardando_pagamento', 'estado inicial errado';

  -- --- 2) Webhook confirma pagamento -> saldo PENDENTE. ----------------------
  v_order := app.confirm_payment(v_order.id, 'mock', 'pay_1');
  assert v_order.funds_state = 'retido', 'fundos deveriam estar retidos';

  select * into v_seller_wallet from public.wallets where user_id = v_seller;
  select * into v_aff_wallet from public.wallets where user_id = v_affiliate;
  assert v_seller_wallet.balance_pending_cents = 8000, 'pendente vendedor errado';
  assert v_aff_wallet.balance_pending_cents = 1500, 'pendente afiliado errado';
  assert v_seller_wallet.balance_available_cents = 0, 'disponivel vendedor deveria ser 0';

  -- IDEMPOTENCIA: confirmar de novo nao pode creditar em dobro.
  v_order := app.confirm_payment(v_order.id, 'mock', 'pay_1');
  select * into v_seller_wallet from public.wallets where user_id = v_seller;
  assert v_seller_wallet.balance_pending_cents = 8000, 'idempotencia falhou: credito duplicado!';

  -- --- 3) Vendedor envia, comprador confirma -> LIBERACAO (disponivel). ------
  v_order := app.mark_shipped(v_order.id, v_seller, 'BR123');
  v_order := app.confirm_delivery(v_order.id, v_buyer);
  assert v_order.funds_state = 'liberado', 'fundos deveriam estar liberados';
  assert v_order.payment_status = 'concluido', 'status deveria ser concluido';

  select * into v_seller_wallet from public.wallets where user_id = v_seller;
  select * into v_aff_wallet from public.wallets where user_id = v_affiliate;
  assert v_seller_wallet.balance_pending_cents = 0, 'pendente vendedor deveria zerar';
  assert v_seller_wallet.balance_available_cents = 8000, 'disponivel vendedor errado';
  assert v_aff_wallet.balance_available_cents = 1500, 'disponivel afiliado errado';

  -- IDEMPOTENCIA: liberar de novo nao pode duplicar.
  v_order := app.release_funds(v_order.id);
  select * into v_seller_wallet from public.wallets where user_id = v_seller;
  assert v_seller_wallet.balance_available_cents = 8000, 'idempotencia liberacao falhou!';

  -- --- 4) INVARIANTE: o ledger inteiro soma zero (partidas dobradas). --------
  -- Forca a verificacao das constraints DEFERRED agora (todos os grupos ja estao
  -- balanceados). Em producao isso ocorre no COMMIT de cada RPC; aqui validamos
  -- dentro da transacao de teste antes do rollback.
  set constraints all immediate;

  select coalesce(sum(amount_cents), 0) into v_ledger_sum from public.ledger_entries;
  assert v_ledger_sum = 0, format('ledger desbalanceado: soma = %s', v_ledger_sum);

  -- --- 5) Reconciliacao carteira vs ledger. ----------------------------------
  assert (select ok from app.reconcile_wallet(v_seller)), 'reconciliacao vendedor falhou';
  assert (select ok from app.reconcile_wallet(v_affiliate)), 'reconciliacao afiliado falhou';

  raise notice 'OK: fluxo de escrow + split + idempotencia + ledger balanceado.';
end$$;

rollback;
