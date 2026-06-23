-- =============================================================================
-- 0025 — Verificacao/moderacao de produto (portao de publicacao) + IMEI + score
-- =============================================================================
-- Modelo "closer marketplace": o DONO cadastra o produto; ele passa por um PORTAO
-- de validacao (fotos + descricao + IMEI) antes de aparecer no marketplace; e um
-- AFILIADO ("closer") o vende por comissao. O escrow/split ja existem.
--
-- Esta migration adiciona SO o que falta:
--   * review_status: pending_review -> approved | partial | rejected
--   * imei estruturado (opcional, com formato e unicidade entre anuncios vivos)
--   * trust_score (0..100) + selo de verificado (derivado de review_status)
--   * app.review_product(): decisao de moderacao (autorizacao de admin na API)
--
-- TUDO aditivo e retrocompativel: colunas novas com default; produtos PRE-EXISTENTES
-- sao retrobackfillados para 'approved' (predatam a moderacao) para nao sumirem.
-- NOTA: a filtragem da listagem (so mostrar approved/partial) e a checagem de
-- compra (so comprar approved) sao aplicadas na CAMADA DE APP no passo seguinte;
-- esta migration prepara o dado e a funcao de decisao.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Enum do status de moderacao.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum (
      'pending_review',  -- aguardando validacao (estado inicial de novos anuncios)
      'approved',        -- aprovado: selo cheio, entra no marketplace
      'partial',         -- aprovado com ressalva: entra com selo baixo
      'rejected'         -- reprovado: nao entra
    );
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- 2) Novas colunas em products.
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists review_status public.review_status not null default 'pending_review',
  add column if not exists imei         text,
  add column if not exists trust_score  smallint not null default 0,
  add column if not exists review_notes text,
  add column if not exists reviewed_at  timestamptz,
  add column if not exists reviewed_by  uuid references public.profiles (id) on delete set null;

-- Score de confianca sempre entre 0 e 100.
alter table public.products
  drop constraint if exists products_trust_score_range;
alter table public.products
  add constraint products_trust_score_range
  check (trust_score between 0 and 100);

-- IMEI, quando informado, e uma string de 14-16 digitos (15 padrao; aceita
-- variacoes/IMEISV). Validacao de bloqueio/roubo e externa (manual no MVP).
alter table public.products
  drop constraint if exists products_imei_format;
alter table public.products
  add constraint products_imei_format
  check (imei is null or imei ~ '^[0-9]{14,16}$');

-- Mesmo aparelho nao pode estar anunciado duas vezes "vivo" ao mesmo tempo.
-- (Anti-fraude: revenda do mesmo IMEI / anuncio duplicado.)
create unique index if not exists products_imei_unique_alive
  on public.products (imei)
  where imei is not null and status <> 'excluido';

-- Fila de moderacao: indice parcial para o admin listar pendentes rapido.
create index if not exists products_review_pending_idx
  on public.products (created_at)
  where review_status = 'pending_review';

-- -----------------------------------------------------------------------------
-- 3) Retrocompatibilidade: produtos que ja existiam predatam a moderacao.
--    Marca como 'approved' com score base para nao sumirem da listagem.
--    (Novos anuncios continuam nascendo 'pending_review' pelo default.)
-- -----------------------------------------------------------------------------
update public.products
   set review_status = 'approved',
       trust_score   = greatest(trust_score, 60),
       reviewed_at   = coalesce(reviewed_at, now())
 where review_status = 'pending_review'
   and created_at < now();

-- -----------------------------------------------------------------------------
-- 4) app.review_product: decisao de moderacao do admin.
--    SECURITY DEFINER; a autorizacao (is_admin) e feita na rota /api/admin/*.
--    decisao: 'approved' | 'partial' | 'rejected'.
--      approved/partial -> garante status 'ativo' (entra no marketplace).
--      rejected         -> status 'pausado' (sai da listagem, nao comprafel).
-- -----------------------------------------------------------------------------
create or replace function app.review_product(
  p_product_id  uuid,
  p_decision    text,
  p_trust_score int,
  p_notes       text default null,
  p_reviewer    uuid default null
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
  if p_decision not in ('approved', 'partial', 'rejected') then
    raise exception 'Decisao invalida: % (use approved|partial|rejected)', p_decision
      using errcode = 'check_violation';
  end if;

  select * into v_product from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Produto inexistente' using errcode = 'no_data_found';
  end if;

  update public.products
     set review_status = p_decision::public.review_status,
         trust_score   = case when p_decision = 'rejected' then 0 else v_score end,
         review_notes  = left(p_notes, 2000),
         reviewed_at   = now(),
         reviewed_by   = p_reviewer,
         -- Sincroniza o ciclo de vida do anuncio com a decisao.
         status        = case
                           when p_decision = 'rejected' then 'pausado'::public.product_status
                           when v_product.status = 'pausado' then 'ativo'::public.product_status
                           else v_product.status
                         end
   where id = p_product_id
  returning * into v_product;

  return v_product;
end;
$$;

comment on function app.review_product is
  'Decisao de moderacao de produto (approved|partial|rejected). Autorizacao de admin na camada de API.';

-- Grant explicito (defesa em profundidade): so o service_role executa.
revoke execute on function app.review_product(uuid, text, integer, text, uuid) from public;
grant execute on function app.review_product(uuid, text, integer, text, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 5) Recria a view products_with_split para EXPOR as colunas novas.
--    A view usa `select p.*`, que e expandido (e fixado) no momento da criacao —
--    colunas adicionadas depois nao aparecem ate recriar. Mantemos exatamente a
--    mesma logica de split da migration 0014; so o `p.*` passa a incluir
--    review_status, imei, trust_score, etc.
-- -----------------------------------------------------------------------------
drop view if exists public.products_with_split;

create view public.products_with_split
with (security_invoker = true) as
select
  p.*,
  public.setting_int('platform_fee_bps', 500)::int as platform_fee_bps,
  public.resolve_commission_bps(p, p.amount_total_cents) as effective_commission_bps,
  floor(p.amount_total_cents * public.resolve_commission_bps(p, p.amount_total_cents) / 10000.0)::bigint as commission_cents,
  floor(p.amount_total_cents * public.setting_int('platform_fee_bps', 500) / 10000.0)::bigint as platform_fee_cents,
  (p.amount_total_cents
    - floor(p.amount_total_cents * public.resolve_commission_bps(p, p.amount_total_cents) / 10000.0)::bigint
    - floor(p.amount_total_cents * public.setting_int('platform_fee_bps', 500) / 10000.0)::bigint
  ) as seller_net_cents,
  coalesce(p.min_price_cents, p.amount_total_cents) as floor_price_cents,
  public.resolve_commission_bps(p, coalesce(p.min_price_cents, p.amount_total_cents)) as floor_commission_bps,
  floor(
    coalesce(p.min_price_cents, p.amount_total_cents)
    * public.resolve_commission_bps(p, coalesce(p.min_price_cents, p.amount_total_cents)) / 10000.0
  )::bigint as floor_commission_cents
from public.products p;

grant select on public.products_with_split to anon, authenticated;
