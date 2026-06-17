-- =============================================================================
-- 0007 — Funcoes financeiras (nucleo do escrow + split)
-- =============================================================================
-- Todas SECURITY DEFINER no schema privado `app`. Cada funcao roda numa unica
-- transacao (atomica). Movimentacoes de carteira usam locks de linha. Os estados
-- (funds_state/payment_status) funcionam como guardas de idempotencia.
--
-- Convencao do ledger:
--   captura  : externo(-T)  | usuario_pendente(vendedor +liquido) | usuario_pendente(afiliado +comissao) | plataforma_pendente(+taxa)
--   liberacao: pendente -> disponivel para cada beneficiario
--   estorno  : pendente -> externo(+T) (devolve ao comprador)
--   saque    : usuario_disponivel(-V) | externo(+V)
-- =============================================================================

-- Helper interno: grava um lado do ledger.
create or replace function app.ledger_post(
  p_group   uuid,
  p_type    public.ledger_type,
  p_account public.ledger_account,
  p_user    uuid,
  p_order   uuid,
  p_amount  bigint,
  p_meta    jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $$
begin
  if p_amount = 0 then
    return; -- nao polui o ledger com lancamentos nulos
  end if;
  insert into public.ledger_entries (entry_group, type, account, user_id, order_id, amount_cents, metadata)
  values (p_group, p_type, p_account, p_user, p_order, p_amount, coalesce(p_meta, '{}'::jsonb));
end;
$$;

-- -----------------------------------------------------------------------------
-- create_order: cria o pedido com os valores congelados (snapshot).
-- Resolve o afiliado a partir do codigo de rastreio (se valido). Sem afiliado,
-- a comissao e ZERO (o vendedor fica com a fatia da comissao).
-- -----------------------------------------------------------------------------
create or replace function app.create_order(
  p_buyer_id        uuid,
  p_product_id      uuid,
  p_affiliate_code  text default null
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
    payment_status, delivery_status, funds_state
  ) values (
    v_product.id, v_product.seller_id, p_buyer_id, v_affiliate_id,
    v_total, case when v_affiliate_id is not null then v_product.commission_bps else 0 end,
    v_platform_bps::int, v_commission, v_platform_fee, v_seller_net,
    'pendente', 'aguardando_envio', 'aguardando_pagamento'
  )
  returning * into v_order;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- confirm_payment: chamada pelo webhook quando o gateway aprova o pagamento.
-- Idempotente: so executa a transicao se funds_state = 'aguardando_pagamento'.
-- Move os valores para o saldo PENDENTE (escrow) dos beneficiarios.
-- -----------------------------------------------------------------------------
create or replace function app.confirm_payment(
  p_order_id           uuid,
  p_provider           text,
  p_provider_payment_id text
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_group uuid := gen_random_uuid();
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente' using errcode = 'no_data_found';
  end if;

  -- GUARDA DE IDEMPOTENCIA: ja capturado/processado => retorna sem reprocessar.
  if v_order.funds_state <> 'aguardando_pagamento' then
    return v_order;
  end if;

  -- Lancamentos do escrow (saldo pendente).
  perform app.ledger_post(v_group, 'captura', 'externo', null, v_order.id,
                          -v_order.amount_total_cents, jsonb_build_object('role','comprador'));
  perform app.ledger_post(v_group, 'captura', 'usuario_pendente', v_order.seller_id, v_order.id,
                          v_order.seller_net_cents, jsonb_build_object('role','vendedor'));
  perform app.ledger_post(v_group, 'captura', 'plataforma_pendente', null, v_order.id,
                          v_order.platform_fee_cents, jsonb_build_object('role','plataforma'));
  if v_order.affiliate_id is not null then
    perform app.ledger_post(v_group, 'captura', 'usuario_pendente', v_order.affiliate_id, v_order.id,
                            v_order.commission_cents, jsonb_build_object('role','afiliado'));
  end if;

  -- Projeta nos saldos das carteiras (com lock).
  perform app.move_pending(v_order.seller_id, v_order.seller_net_cents);
  if v_order.affiliate_id is not null then
    perform app.move_pending(v_order.affiliate_id, v_order.commission_cents);
  end if;

  update public.orders
     set payment_status      = 'aprovado',
         funds_state         = 'retido',
         payment_provider    = p_provider,
         provider_payment_id = p_provider_payment_id
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- mark_shipped: vendedor informa envio/rastreio. Inicia a contagem do escrow.
-- -----------------------------------------------------------------------------
create or replace function app.mark_shipped(
  p_order_id      uuid,
  p_actor_id      uuid,
  p_tracking_code text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_days  bigint := public.setting_int('escrow_auto_release_days', 7);
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente' using errcode = 'no_data_found';
  end if;
  if v_order.seller_id <> p_actor_id then
    raise exception 'Apenas o vendedor pode marcar como enviado'
      using errcode = 'insufficient_privilege';
  end if;
  if v_order.funds_state <> 'retido' then
    raise exception 'Pedido nao esta pago/retido' using errcode = 'check_violation';
  end if;

  update public.orders
     set delivery_status = 'em_transito',
         tracking_code   = coalesce(p_tracking_code, tracking_code),
         shipped_at      = coalesce(shipped_at, now()),
         -- Mecanismo de defesa: libera sozinho apos X dias se o comprador sumir.
         auto_release_at = now() + make_interval(days => v_days::int)
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- release_funds: move pendente -> disponivel para vendedor, afiliado e plataforma.
-- Idempotente: so age se funds_state = 'retido'. Bloqueia se em disputa.
-- -----------------------------------------------------------------------------
create or replace function app.release_funds(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_group uuid := gen_random_uuid();
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente' using errcode = 'no_data_found';
  end if;

  if v_order.funds_state = 'liberado' then
    return v_order; -- idempotente
  end if;
  if v_order.payment_status = 'em_disputa' then
    raise exception 'Pedido em disputa: liberacao bloqueada' using errcode = 'check_violation';
  end if;
  if v_order.funds_state <> 'retido' then
    raise exception 'Fundos nao estao retidos (estado: %)', v_order.funds_state
      using errcode = 'check_violation';
  end if;

  -- Vendedor: pendente -> disponivel
  perform app.ledger_post(v_group, 'liberacao', 'usuario_pendente', v_order.seller_id, v_order.id,
                          -v_order.seller_net_cents, jsonb_build_object('role','vendedor'));
  perform app.ledger_post(v_group, 'liberacao', 'usuario_disponivel', v_order.seller_id, v_order.id,
                          v_order.seller_net_cents, jsonb_build_object('role','vendedor'));
  -- Plataforma: pendente -> disponivel
  perform app.ledger_post(v_group, 'liberacao', 'plataforma_pendente', null, v_order.id,
                          -v_order.platform_fee_cents, jsonb_build_object('role','plataforma'));
  perform app.ledger_post(v_group, 'liberacao', 'plataforma_disponivel', null, v_order.id,
                          v_order.platform_fee_cents, jsonb_build_object('role','plataforma'));
  -- Afiliado: pendente -> disponivel
  if v_order.affiliate_id is not null then
    perform app.ledger_post(v_group, 'liberacao', 'usuario_pendente', v_order.affiliate_id, v_order.id,
                            -v_order.commission_cents, jsonb_build_object('role','afiliado'));
    perform app.ledger_post(v_group, 'liberacao', 'usuario_disponivel', v_order.affiliate_id, v_order.id,
                            v_order.commission_cents, jsonb_build_object('role','afiliado'));
  end if;

  -- Projeta nas carteiras.
  perform app.move_pending(v_order.seller_id, -v_order.seller_net_cents);
  perform app.move_available(v_order.seller_id, v_order.seller_net_cents);
  if v_order.affiliate_id is not null then
    perform app.move_pending(v_order.affiliate_id, -v_order.commission_cents);
    perform app.move_available(v_order.affiliate_id, v_order.commission_cents);
  end if;

  update public.orders
     set funds_state    = 'liberado',
         payment_status = 'concluido',
         released_at    = now()
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- confirm_delivery: comprador confirma recebimento -> libera os fundos.
-- -----------------------------------------------------------------------------
create or replace function app.confirm_delivery(p_order_id uuid, p_actor_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente' using errcode = 'no_data_found';
  end if;
  if v_order.buyer_id <> p_actor_id then
    raise exception 'Apenas o comprador pode confirmar o recebimento'
      using errcode = 'insufficient_privilege';
  end if;

  update public.orders
     set delivery_status = 'entregue',
         delivered_at    = coalesce(delivered_at, now())
   where id = v_order.id;

  return app.release_funds(p_order_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- open_dispute: comprador abre disputa. Congela os fundos (continuam pendentes).
-- -----------------------------------------------------------------------------
create or replace function app.open_dispute(p_order_id uuid, p_actor_id uuid, p_reason text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente' using errcode = 'no_data_found';
  end if;
  if v_order.buyer_id <> p_actor_id then
    raise exception 'Apenas o comprador pode abrir disputa'
      using errcode = 'insufficient_privilege';
  end if;
  if v_order.funds_state <> 'retido' then
    raise exception 'So e possivel disputar pedidos com fundos retidos'
      using errcode = 'check_violation';
  end if;

  update public.orders
     set payment_status = 'em_disputa',
         dispute_reason = left(p_reason, 2000),
         auto_release_at = null  -- congela: nao libera automaticamente
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- refund_order: estorna ao comprador (pendente -> externo). Idempotente.
-- O estorno financeiro no gateway e feito na camada de aplicacao; aqui
-- registramos o efeito contabil.
-- -----------------------------------------------------------------------------
create or replace function app.refund_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_group uuid := gen_random_uuid();
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente' using errcode = 'no_data_found';
  end if;

  if v_order.funds_state = 'estornado' then
    return v_order; -- idempotente
  end if;
  if v_order.funds_state <> 'retido' then
    raise exception 'So e possivel estornar fundos retidos (estado: %)', v_order.funds_state
      using errcode = 'check_violation';
  end if;

  perform app.ledger_post(v_group, 'estorno', 'usuario_pendente', v_order.seller_id, v_order.id,
                          -v_order.seller_net_cents, jsonb_build_object('role','vendedor'));
  perform app.ledger_post(v_group, 'estorno', 'plataforma_pendente', null, v_order.id,
                          -v_order.platform_fee_cents, jsonb_build_object('role','plataforma'));
  if v_order.affiliate_id is not null then
    perform app.ledger_post(v_group, 'estorno', 'usuario_pendente', v_order.affiliate_id, v_order.id,
                            -v_order.commission_cents, jsonb_build_object('role','afiliado'));
  end if;
  perform app.ledger_post(v_group, 'estorno', 'externo', null, v_order.id,
                          v_order.amount_total_cents, jsonb_build_object('role','comprador'));

  perform app.move_pending(v_order.seller_id, -v_order.seller_net_cents);
  if v_order.affiliate_id is not null then
    perform app.move_pending(v_order.affiliate_id, -v_order.commission_cents);
  end if;

  update public.orders
     set funds_state    = 'estornado',
         payment_status = 'estornado',
         refunded_at    = now()
   where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- -----------------------------------------------------------------------------
-- resolve_dispute: mediacao decide. 'liberar' paga aos vendedores; 'estornar'
-- devolve ao comprador. (Autorizacao de admin e feita na camada de API.)
-- -----------------------------------------------------------------------------
create or replace function app.resolve_dispute(p_order_id uuid, p_outcome text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente' using errcode = 'no_data_found';
  end if;
  if v_order.payment_status <> 'em_disputa' then
    raise exception 'Pedido nao esta em disputa' using errcode = 'check_violation';
  end if;

  -- Reabilita a transicao: tira o flag de disputa antes de aplicar o desfecho.
  update public.orders set payment_status = 'aprovado' where id = v_order.id;

  if p_outcome = 'liberar' then
    return app.release_funds(p_order_id);
  elsif p_outcome = 'estornar' then
    return app.refund_order(p_order_id);
  else
    raise exception 'Desfecho invalido: % (use liberar|estornar)', p_outcome
      using errcode = 'check_violation';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- auto_release_due: liberacao automatica (mecanismo de defesa). Chamada por cron.
-- -----------------------------------------------------------------------------
create or replace function app.auto_release_due()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.orders
     where funds_state = 'retido'
       and payment_status <> 'em_disputa'
       and auto_release_at is not null
       and auto_release_at <= now()
     order by auto_release_at
     for update skip locked
  loop
    begin
      perform app.release_funds(v_id);
      v_count := v_count + 1;
    exception when others then
      -- Nao deixa um pedido problematico travar o lote.
      raise warning 'Falha ao liberar pedido % automaticamente: %', v_id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- request_withdrawal: usuario saca do saldo_disponivel. Debita e cria payout.
-- O disbursement real (PIX) e disparado pela aplicacao; aqui garantimos o debito
-- atomico para o saldo nunca ficar negativo / nao ser sacado em dobro.
-- -----------------------------------------------------------------------------
create or replace function app.request_withdrawal(
  p_user_id uuid,
  p_amount_cents bigint,
  p_pix_key text
)
returns public.withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wallet     public.wallets;
  v_withdrawal public.withdrawals;
  v_group      uuid := gen_random_uuid();
begin
  if p_amount_cents <= 0 then
    raise exception 'Valor de saque invalido' using errcode = 'check_violation';
  end if;

  select * into v_wallet from public.wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'Carteira inexistente' using errcode = 'no_data_found';
  end if;
  if v_wallet.balance_available_cents < p_amount_cents then
    raise exception 'Saldo disponivel insuficiente' using errcode = 'check_violation';
  end if;

  insert into public.withdrawals (user_id, amount_cents, pix_key, status)
  values (p_user_id, p_amount_cents, p_pix_key, 'solicitado')
  returning * into v_withdrawal;

  -- Debita o disponivel e registra a saida no ledger.
  perform app.move_available(p_user_id, -p_amount_cents);
  perform app.ledger_post(v_group, 'saque', 'usuario_disponivel', p_user_id, null,
                          -p_amount_cents, jsonb_build_object('withdrawal_id', v_withdrawal.id));
  perform app.ledger_post(v_group, 'saque', 'externo', null, null,
                          p_amount_cents, jsonb_build_object('withdrawal_id', v_withdrawal.id));

  return v_withdrawal;
end;
$$;

-- Reverte um saque que falhou no gateway (devolve ao saldo disponivel).
create or replace function app.fail_withdrawal(p_withdrawal_id uuid, p_reason text)
returns public.withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_withdrawal public.withdrawals;
  v_group      uuid := gen_random_uuid();
begin
  select * into v_withdrawal from public.withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Saque inexistente' using errcode = 'no_data_found';
  end if;
  if v_withdrawal.status in ('falhou', 'cancelado') then
    return v_withdrawal; -- idempotente
  end if;
  if v_withdrawal.status = 'pago' then
    raise exception 'Saque ja pago nao pode ser revertido' using errcode = 'check_violation';
  end if;

  perform app.move_available(v_withdrawal.user_id, v_withdrawal.amount_cents);
  perform app.ledger_post(v_group, 'saque', 'externo', null, null,
                          -v_withdrawal.amount_cents, jsonb_build_object('withdrawal_id', v_withdrawal.id, 'revert', true));
  perform app.ledger_post(v_group, 'saque', 'usuario_disponivel', v_withdrawal.user_id, null,
                          v_withdrawal.amount_cents, jsonb_build_object('withdrawal_id', v_withdrawal.id, 'revert', true));

  update public.withdrawals
     set status = 'falhou', failure_reason = left(p_reason, 1000)
   where id = p_withdrawal_id
  returning * into v_withdrawal;

  return v_withdrawal;
end;
$$;
