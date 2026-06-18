-- =============================================================================
-- 0016 — Chat entre afiliado e vendedor
-- =============================================================================
-- Um afiliado interessado em promover um anuncio abre conversa com o vendedor.
-- Uma conversa por (produto, afiliado). RLS garante que so os dois participantes
-- leem e escrevem.
-- =============================================================================

create table if not exists public.conversations (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  seller_id    uuid not null references public.profiles (id),
  affiliate_id uuid not null references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product_id, affiliate_id),
  constraint conversations_distinct check (seller_id <> affiliate_id)
);

create index if not exists conversations_seller_idx on public.conversations (seller_id, updated_at desc);
create index if not exists conversations_affiliate_idx on public.conversations (affiliate_id, updated_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id),
  body            text not null check (length(trim(body)) between 1 and 4000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- Bump em updated_at da conversa a cada mensagem (ordena a caixa de entrada).
create or replace function app.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_conversation_on_message on public.messages;
create trigger touch_conversation_on_message
  after insert on public.messages
  for each row execute function app.touch_conversation();

-- -----------------------------------------------------------------------------
-- start_conversation: o afiliado abre (ou reaproveita) a conversa com o vendedor
-- de um anuncio. Idempotente pelo par (produto, afiliado).
-- -----------------------------------------------------------------------------
create or replace function app.start_conversation(
  p_actor_id   uuid,
  p_product_id uuid
)
returns public.conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_conv    public.conversations;
begin
  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'Produto inexistente' using errcode = 'no_data_found';
  end if;
  if v_product.seller_id = p_actor_id then
    raise exception 'O vendedor nao abre conversa consigo mesmo' using errcode = 'check_violation';
  end if;

  select * into v_conv from public.conversations
   where product_id = p_product_id and affiliate_id = p_actor_id;
  if found then
    return v_conv;
  end if;

  insert into public.conversations (product_id, seller_id, affiliate_id)
  values (p_product_id, v_product.seller_id, p_actor_id)
  returning * into v_conv;

  return v_conv;
end;
$$;

-- RLS ----------------------------------------------------------------------
alter table public.conversations enable row level security;
drop policy if exists conversations_select_part on public.conversations;
create policy conversations_select_part on public.conversations
  for select to authenticated
  using ((select auth.uid()) in (seller_id, affiliate_id));
-- Criacao via RPC (service_role). Sem insert/update por cliente.

alter table public.messages enable row level security;

drop policy if exists messages_select_part on public.messages;
create policy messages_select_part on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and (select auth.uid()) in (c.seller_id, c.affiliate_id)
    )
  );

drop policy if exists messages_insert_part on public.messages;
create policy messages_insert_part on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and (select auth.uid()) in (c.seller_id, c.affiliate_id)
    )
  );

-- Marcar como lida: o destinatario (participante que nao enviou) pode setar read_at.
drop policy if exists messages_update_read on public.messages;
create policy messages_update_read on public.messages
  for update to authenticated
  using (
    sender_id <> (select auth.uid())
    and exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and (select auth.uid()) in (c.seller_id, c.affiliate_id)
    )
  )
  with check (
    sender_id <> (select auth.uid())
    and exists (
      select 1 from public.conversations c
       where c.id = conversation_id
         and (select auth.uid()) in (c.seller_id, c.affiliate_id)
    )
  );

grant select on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
