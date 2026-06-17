-- =============================================================================
-- 0003 — Links de afiliado e rastreamento de cliques
-- =============================================================================

create table if not exists public.affiliate_links (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references public.profiles (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  tracking_code text not null unique,
  clicks        bigint not null default 0,
  created_at    timestamptz not null default now(),
  -- Um afiliado tem no maximo um link por produto (reuso do mesmo codigo).
  unique (affiliate_id, product_id)
);

create index if not exists affiliate_links_affiliate_idx
  on public.affiliate_links (affiliate_id);
create index if not exists affiliate_links_product_idx
  on public.affiliate_links (product_id);

-- Cliques detalhados (opcional, para analytics). IP guardado como hash.
create table if not exists public.affiliate_clicks (
  id         bigint generated always as identity primary key,
  link_id    uuid not null references public.affiliate_links (id) on delete cascade,
  ip_hash    text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_clicks_link_idx
  on public.affiliate_clicks (link_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Funcao: gera (ou reaproveita) o link de afiliado de forma idempotente.
-- Um vendedor nao pode se afiliar ao proprio produto.
-- -----------------------------------------------------------------------------
create or replace function app.create_affiliate_link(
  p_affiliate_id uuid,
  p_product_id   uuid
)
returns public.affiliate_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link    public.affiliate_links;
  v_product public.products;
  v_code    text;
begin
  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'Produto inexistente' using errcode = 'no_data_found';
  end if;
  if v_product.status <> 'ativo' then
    raise exception 'Produto nao esta ativo' using errcode = 'check_violation';
  end if;
  if v_product.seller_id = p_affiliate_id then
    raise exception 'Vendedor nao pode se afiliar ao proprio produto'
      using errcode = 'check_violation';
  end if;

  -- Reaproveita link existente (idempotente).
  select * into v_link from public.affiliate_links
   where affiliate_id = p_affiliate_id and product_id = p_product_id;
  if found then
    return v_link;
  end if;

  -- Codigo curto, unico e nao sequencial. gen_random_uuid() e funcao core
  -- (pg_catalog), entao resolve mesmo com search_path = ''. Retenta em caso de
  -- colisao (extremamente improvavel).
  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    begin
      insert into public.affiliate_links (affiliate_id, product_id, tracking_code)
      values (p_affiliate_id, p_product_id, v_code)
      returning * into v_link;
      exit;
    exception when unique_violation then
      -- Pode ser corrida na constraint (affiliate_id, product_id): se ja existe
      -- link para este par, retorna-o. Caso contrario foi colisao de codigo: retenta.
      select * into v_link from public.affiliate_links
       where affiliate_id = p_affiliate_id and product_id = p_product_id;
      if found then
        exit;
      end if;
      continue;
    end;
  end loop;

  return v_link;
end;
$$;

-- -----------------------------------------------------------------------------
-- Funcao: registra clique e incrementa contador atomicamente.
-- -----------------------------------------------------------------------------
create or replace function app.register_affiliate_click(
  p_tracking_code text,
  p_ip_hash       text default null,
  p_user_agent    text default null
)
returns public.affiliate_links
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.affiliate_links;
begin
  update public.affiliate_links
     set clicks = clicks + 1
   where tracking_code = p_tracking_code
  returning * into v_link;

  if not found then
    raise exception 'Codigo de rastreio invalido' using errcode = 'no_data_found';
  end if;

  insert into public.affiliate_clicks (link_id, ip_hash, user_agent)
  values (v_link.id, p_ip_hash, left(p_user_agent, 400));

  return v_link;
end;
$$;
