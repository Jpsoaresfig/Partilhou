-- =============================================================================
-- 0023 — Reputacao do COMPRADOR (avaliacao 360°)
-- =============================================================================
-- Ate aqui o comprador avaliava o vendedor e o afiliado. Agora o VENDEDOR tambem
-- avalia o COMPRADOR ("se o comprador presta"): pagou direito, comunicou bem etc.
-- Reaproveita a tabela `ratings` e a view `profile_reputation`, apenas:
--   1) liberando o novo papel 'comprador' no CHECK;
--   2) ensinando a funcao app.rate_order a tratar quem avalia quem.
-- =============================================================================

alter table public.ratings drop constraint if exists ratings_role_check;
alter table public.ratings
  add constraint ratings_role_check check (role in ('vendedor', 'afiliado', 'comprador'));

-- -----------------------------------------------------------------------------
-- rate_order (atualizada): roteia ator -> avaliado conforme o papel.
--   * vendedor  -> avaliado pelo COMPRADOR (ratee = seller)
--   * afiliado  -> avaliado pelo COMPRADOR (ratee = affiliate)
--   * comprador -> avaliado pelo VENDEDOR  (ratee = buyer)
-- Sempre apos a conclusao (funds_state = 'liberado'). Uma por (pedido, papel).
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
  if p_role not in ('vendedor', 'afiliado', 'comprador') then
    raise exception 'Papel invalido' using errcode = 'check_violation';
  end if;
  if p_score < 1 or p_score > 5 then
    raise exception 'Nota deve ser de 1 a 5' using errcode = 'check_violation';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido inexistente' using errcode = 'no_data_found';
  end if;
  if v_order.funds_state <> 'liberado' then
    raise exception 'So e possivel avaliar apos a conclusao do pedido'
      using errcode = 'check_violation';
  end if;

  if p_role = 'comprador' then
    -- O vendedor avalia o comprador.
    if v_order.seller_id <> p_actor_id then
      raise exception 'Apenas o vendedor avalia o comprador deste pedido'
        using errcode = 'insufficient_privilege';
    end if;
    v_ratee := v_order.buyer_id;
  else
    -- O comprador avalia vendedor/afiliado.
    if v_order.buyer_id <> p_actor_id then
      raise exception 'Apenas o comprador avalia este pedido'
        using errcode = 'insufficient_privilege';
    end if;
    if p_role = 'vendedor' then
      v_ratee := v_order.seller_id;
    else
      v_ratee := v_order.affiliate_id;
      if v_ratee is null then
        raise exception 'Este pedido nao teve afiliado' using errcode = 'check_violation';
      end if;
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
