-- =============================================================================
-- 0015 — Reputacao: avaliacoes de vendedor e afiliado
-- =============================================================================
-- Apos um pedido concluido, o comprador avalia o VENDEDOR e (se houve) o
-- AFILIADO, de 1 a 5. A media por papel vira a "confiabilidade" exibida nos
-- perfis e nos anuncios ("bom vendedor" / "bom afiliado").
-- A escrita e feita por funcao SECURITY DEFINER (regras de negocio + posse).
-- =============================================================================

create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  rater_id   uuid not null references public.profiles (id),
  ratee_id   uuid not null references public.profiles (id),
  role       text not null check (role in ('vendedor', 'afiliado')),
  score      smallint not null check (score between 1 and 5),
  comment    text check (comment is null or length(comment) <= 1000),
  created_at timestamptz not null default now(),
  -- Uma avaliacao por (pedido, papel): o comprador avalia o vendedor uma vez e
  -- o afiliado uma vez por pedido.
  unique (order_id, role),
  constraint ratings_no_self check (rater_id <> ratee_id)
);

create index if not exists ratings_ratee_idx on public.ratings (ratee_id, role);

-- Reputacao agregada por usuario e papel.
create or replace view public.profile_reputation
with (security_invoker = true) as
select
  ratee_id,
  role,
  round(avg(score)::numeric, 2) as avg_score,
  count(*)::int                 as ratings_count
from public.ratings
group by ratee_id, role;

-- -----------------------------------------------------------------------------
-- rate_order: comprador avalia vendedor/afiliado de um pedido concluido.
-- -----------------------------------------------------------------------------
create or replace function app.rate_order(
  p_order_id uuid,
  p_actor_id uuid,
  p_role     text,
  p_score    int,
  p_comment  text default null
)
returns public.ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order  public.orders;
  v_ratee  uuid;
  v_rating public.ratings;
begin
  if p_role not in ('vendedor', 'afiliado') then
    raise exception 'Papel invalido' using errcode = 'check_violation';
  end if;
  if p_score < 1 or p_score > 5 then
    raise exception 'Nota deve ser de 1 a 5' using errcode = 'check_violation';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente' using errcode = 'no_data_found';
  end if;
  if v_order.buyer_id <> p_actor_id then
    raise exception 'Apenas o comprador avalia este pedido'
      using errcode = 'insufficient_privilege';
  end if;
  if v_order.funds_state <> 'liberado' then
    raise exception 'So e possivel avaliar apos a conclusao do pedido'
      using errcode = 'check_violation';
  end if;

  if p_role = 'vendedor' then
    v_ratee := v_order.seller_id;
  else
    v_ratee := v_order.affiliate_id;
    if v_ratee is null then
      raise exception 'Este pedido nao teve afiliado' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.ratings (order_id, rater_id, ratee_id, role, score, comment)
  values (p_order_id, p_actor_id, v_ratee, p_role, p_score, nullif(left(p_comment, 1000), ''))
  on conflict (order_id, role)
  do update set score = excluded.score, comment = excluded.comment, created_at = now()
  returning * into v_rating;

  return v_rating;
end;
$$;

-- RLS: reputacao e publica (leitura); escrita so via RPC/service_role.
alter table public.ratings enable row level security;
drop policy if exists ratings_select_public on public.ratings;
create policy ratings_select_public on public.ratings
  for select to anon, authenticated using (true);

grant select on public.ratings           to anon, authenticated;
grant select on public.profile_reputation to anon, authenticated;
