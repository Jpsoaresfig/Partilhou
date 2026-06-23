-- =============================================================================
-- 0030 — Expiracao de reservas (carrinho abandonado)
-- =============================================================================
-- A reserva (0029) tira o produto de 'ativo' ao criar o pedido. Se o comprador
-- nao pagar, o produto ficaria preso em 'reservado' para sempre. Este job anula
-- pedidos NAO PAGOS antigos:
--   * funds_state aguardando_pagamento -> estornado (cancelado/void)
--   * o trigger sync_product_status (0029) entao devolve o produto a 'ativo'
--   * confirm_payment ja recusa pagamento tardio (guard funds_state)
-- Nao posta no ledger (nada foi capturado) -> nenhum impacto financeiro.
-- =============================================================================

-- TTL configuravel (minutos) sem deploy.
insert into public.platform_settings (key, value, description) values
  ('reservation_ttl_minutes', '30', 'Minutos sem pagamento ate a reserva do produto expirar.')
on conflict (key) do nothing;

create or replace function app.expire_stale_reservations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_count integer := 0;
  v_ttl   bigint  := public.setting_int('reservation_ttl_minutes', 30);
begin
  for v_id in
    select id from public.orders
     where funds_state = 'aguardando_pagamento'
       and created_at < now() - make_interval(mins => v_ttl::int)
     order by created_at
     for update skip locked
  loop
    begin
      -- Void: marca como estornado. O trigger 0029 relista o produto (-> ativo).
      update public.orders
         set funds_state    = 'estornado',
             payment_status = 'estornado',
             refunded_at    = now()
       where id = v_id and funds_state = 'aguardando_pagamento';
      v_count := v_count + 1;
    exception when others then
      raise warning 'Falha ao expirar reserva do pedido %: %', v_id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

comment on function app.expire_stale_reservations is
  'Anula pedidos nao-pagos antigos (carrinho abandonado) e relista o produto via trigger.';

revoke execute on function app.expire_stale_reservations() from public;
grant execute on function app.expire_stale_reservations() to service_role;

-- Agenda o job a cada 10 minutos, se pg_cron existir.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'partilhou_expire_reservations';

    perform cron.schedule(
      'partilhou_expire_reservations',
      '*/10 * * * *',
      $job$ select app.expire_stale_reservations(); $job$
    );
  else
    raise warning 'pg_cron indisponivel: agende app.expire_stale_reservations() externamente.';
  end if;
end$$;
