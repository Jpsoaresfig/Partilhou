-- =============================================================================
-- 0006 — Eventos de pagamento (idempotencia de webhooks)
-- =============================================================================
-- O gateway pode reenviar a mesma notificacao varias vezes. Garantimos que o
-- repasse NAO seja creditado em duplicidade com DUAS camadas:
--   1) Chave unica (provider, event_id): registramos o evento ANTES de processar.
--      Reentrada com o mesmo id e descartada (ON CONFLICT DO NOTHING).
--   2) Guarda de estado nas funcoes financeiras (funds_state): mesmo que o passo
--      1 falhe, a funcao so executa a transicao se o pedido estiver no estado
--      esperado. Dupla protecao.
-- =============================================================================

create table if not exists public.payment_events (
  id          bigint generated always as identity primary key,
  provider    text not null,
  -- Identificador unico do evento no gateway (ex.: id da notificacao/payment).
  event_id    text not null,
  event_type  text,
  resource_id text,                 -- id do recurso (payment) no gateway
  order_id    uuid references public.orders (id),
  payload     jsonb not null default '{}'::jsonb,
  status      text not null default 'recebido'
                check (status in ('recebido', 'processado', 'ignorado', 'erro')),
  error       text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

create index if not exists payment_events_order_idx on public.payment_events (order_id);
create index if not exists payment_events_status_idx on public.payment_events (status);

-- Registra um evento de forma idempotente. Retorna TRUE se e novo (deve ser
-- processado) ou FALSE se ja foi visto (deve ser ignorado).
create or replace function app.record_payment_event(
  p_provider    text,
  p_event_id    text,
  p_event_type  text,
  p_resource_id text,
  p_payload     jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean := false;
begin
  insert into public.payment_events (provider, event_id, event_type, resource_id, payload)
  values (p_provider, p_event_id, p_event_type, p_resource_id, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, event_id) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;
