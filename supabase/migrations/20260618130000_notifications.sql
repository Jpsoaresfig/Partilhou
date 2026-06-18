-- =============================================================================
-- 0014 — Notificacoes
-- =============================================================================
-- Caixa de entrada por usuario. As linhas sao criadas SEMPRE pelo servidor via
-- funcoes/gatilhos SECURITY DEFINER (schema app) nas transicoes de estado de
-- pedidos e saques. O cliente apenas LE as proprias e marca como lida (read_at).
-- =============================================================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,                 -- venda | compra | comissao | envio | ...
  title      text not null,
  body       text,
  link       text,                          -- rota interna (ex: /pedidos/<id>)
  read_at    timestamptz,                   -- nulo = nao lida
  created_at timestamptz not null default now()
);

-- Lista do usuario, mais recentes primeiro.
create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
-- Contagem rapida de nao lidas (badge).
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

-- -----------------------------------------------------------------------------
-- RLS: cada um ve e marca como lida apenas as proprias.
-- -----------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Grants: leitura do dono e marcacao de leitura (somente a coluna read_at).
-- Sem insert/delete para clientes: a escrita acontece via funcoes do schema app.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- -----------------------------------------------------------------------------
-- Helper: cria uma notificacao. Ignora silenciosamente user nulo (ex: afiliado
-- ausente), o que simplifica os gatilhos.
-- -----------------------------------------------------------------------------
create or replace function app.notify(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text default null,
  p_link    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
end;
$$;

-- -----------------------------------------------------------------------------
-- Gatilho de pedidos: traduz transicoes de estado em notificacoes para as
-- partes envolvidas. AFTER UPDATE — a criacao do pedido (pendente) nao notifica.
-- -----------------------------------------------------------------------------
create or replace function app.orders_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_link  text := '/pedidos/' || new.id::text;
begin
  select p.title into v_title from public.products p where p.id = new.product_id;
  v_title := coalesce(v_title, 'seu produto');

  -- Pagamento aprovado: entrou no escrow (retido).
  if old.funds_state = 'aguardando_pagamento' and new.funds_state = 'retido' then
    perform app.notify(new.buyer_id, 'compra', 'Pagamento confirmado',
      'Seu pagamento de "' || v_title || '" foi confirmado.', v_link);
    perform app.notify(new.seller_id, 'venda', 'Voce vendeu!',
      'Seu produto "' || v_title || '" foi vendido. Prepare o envio.', v_link);
    perform app.notify(new.affiliate_id, 'comissao', 'Venda por indicacao',
      'Sua indicacao gerou uma venda de "' || v_title || '".', v_link);
  end if;

  -- Envio informado pelo vendedor.
  if old.delivery_status is distinct from 'em_transito'
     and new.delivery_status = 'em_transito' then
    perform app.notify(new.buyer_id, 'envio', 'Pedido enviado',
      case when new.tracking_code is not null
        then 'Seu pedido "' || v_title || '" foi enviado. Rastreio: ' || new.tracking_code || '.'
        else 'Seu pedido "' || v_title || '" foi enviado.'
      end, v_link);
  end if;

  -- Fundos liberados (entrega confirmada ou liberacao automatica).
  if old.funds_state is distinct from 'liberado' and new.funds_state = 'liberado' then
    perform app.notify(new.seller_id, 'liberacao', 'Pagamento liberado',
      'O valor da venda de "' || v_title || '" foi liberado para saque.', v_link);
    perform app.notify(new.affiliate_id, 'liberacao', 'Comissao liberada',
      'Sua comissao por "' || v_title || '" foi liberada para saque.', v_link);
    perform app.notify(new.buyer_id, 'compra', 'Compra concluida',
      'Pedido "' || v_title || '" concluido. Obrigado!', v_link);
  end if;

  -- Disputa aberta pelo comprador.
  if old.payment_status is distinct from 'em_disputa'
     and new.payment_status = 'em_disputa' then
    perform app.notify(new.seller_id, 'disputa', 'Pedido em disputa',
      'O comprador abriu uma disputa em "' || v_title || '".', v_link);
  end if;

  -- Estorno ao comprador.
  if old.funds_state is distinct from 'estornado' and new.funds_state = 'estornado' then
    perform app.notify(new.buyer_id, 'estorno', 'Pedido estornado',
      'O valor de "' || v_title || '" foi devolvido a voce.', v_link);
    perform app.notify(new.seller_id, 'estorno', 'Venda estornada',
      'A venda de "' || v_title || '" foi estornada ao comprador.', v_link);
  end if;

  return null;  -- AFTER trigger: valor de retorno ignorado.
end;
$$;

drop trigger if exists notify_orders on public.orders;
create trigger notify_orders after update on public.orders
  for each row execute function app.orders_notify();

-- -----------------------------------------------------------------------------
-- Gatilho de saques: solicitado / concluido / falhou.
-- -----------------------------------------------------------------------------
create or replace function app.withdrawals_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform app.notify(new.user_id, 'saque', 'Saque solicitado',
      'Recebemos seu pedido de saque. Voce sera avisado quando for pago.', '/carteira');
    return null;
  end if;

  if old.status is distinct from new.status then
    if new.status = 'pago' then
      perform app.notify(new.user_id, 'saque', 'Saque concluido',
        'Seu saque foi pago via PIX.', '/carteira');
    elsif new.status = 'falhou' then
      perform app.notify(new.user_id, 'saque', 'Saque falhou',
        coalesce(new.failure_reason, 'Nao foi possivel concluir seu saque. O valor voltou ao saldo.'),
        '/carteira');
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists notify_withdrawals on public.withdrawals;
create trigger notify_withdrawals after insert or update on public.withdrawals
  for each row execute function app.withdrawals_notify();
