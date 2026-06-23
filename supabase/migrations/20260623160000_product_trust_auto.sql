-- =============================================================================
-- 0026 — Classificacao de confianca AUTOMATICA e NAO bloqueante
-- =============================================================================
-- Complementa a 0025 (moderacao manual do admin). Em vez de prender todo anuncio
-- em 'pending_review' ate um admin agir (o que esconde produtos e mata liquidez),
-- o anuncio nasce JA CLASSIFICADO por completude/consistencia:
--   approved (verificado) | partial | unverified
-- e aparece no marketplace na hora — apenas com mais ou menos destaque.
--
-- O admin continua soberano: app.review_product (0025) pode rejeitar/sobrescrever
-- e grava reviewed_by. A reclassificacao automatica abaixo NUNCA pisa numa
-- decisao humana (reviewed_by not null) nem pausa/despublica o anuncio.
--
-- Tudo aditivo e retrocompativel.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Novo valor de enum: 'unverified' (anuncio publicado, porem sem validacao).
--    ADD VALUE e idempotente e seguro fora de uso imediato no mesmo statement;
--    so e referenciado em RUNTIME (corpo da funcao), nunca avaliado na migration.
-- -----------------------------------------------------------------------------
alter type public.review_status add value if not exists 'unverified';

-- -----------------------------------------------------------------------------
-- 2) app.classify_product: aplica score + status calculados pela APP.
--    Diferente de app.review_product (decisao humana), esta funcao:
--      * aceita approved | partial | unverified (nunca 'rejected');
--      * NAO altera o ciclo de vida do anuncio (status ativo/pausado/vendido);
--      * NAO mexe em reviewed_by/reviewed_at;
--      * NAO sobrescreve um anuncio ja moderado por um humano (reviewed_by set)
--        nem um anuncio rejeitado — devolve a linha intacta nesses casos.
--    Autorizacao (dono do anuncio ou admin) e feita na camada de API.
-- -----------------------------------------------------------------------------
create or replace function app.classify_product(
  p_product_id uuid,
  p_status     text,
  p_trust_score int
)
returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_score   int := greatest(0, least(100, coalesce(p_trust_score, 0)));
begin
  if p_status not in ('approved', 'partial', 'unverified') then
    raise exception 'Status invalido: % (use approved|partial|unverified)', p_status
      using errcode = 'check_violation';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produto inexistente' using errcode = 'no_data_found';
  end if;

  -- Respeita decisao humana e rejeicao: nao reclassifica automaticamente.
  if v_product.reviewed_by is not null or v_product.review_status = 'rejected' then
    return v_product;
  end if;

  update public.products
     set review_status = p_status::public.review_status,
         trust_score   = v_score
   where id = p_product_id
  returning * into v_product;

  return v_product;
end;
$$;

comment on function app.classify_product is
  'Classificacao de confianca automatica (approved|partial|unverified). Nao pisa em decisao humana nem despublica. Autorizacao na API.';

-- -----------------------------------------------------------------------------
-- 3) Indice de ranking: destaque por confianca (trust_score desc) entre os
--    anuncios visiveis. A listagem ordena por trust_score; este indice ajuda.
-- -----------------------------------------------------------------------------
create index if not exists products_trust_rank_idx
  on public.products (trust_score desc, created_at desc)
  where status = 'ativo' and review_status <> 'rejected';
