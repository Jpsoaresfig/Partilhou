-- =============================================================================
-- 0014 — Campos de perfil (localizacao, nascimento) e regiao do anuncio
-- =============================================================================
-- Perfil ganha "de onde e" (cidade + UF) e ano de nascimento. Produtos ganham
-- regiao (UF) para o filtro da vitrine. UF validada por funcao canonica.
-- =============================================================================

-- Validacao canonica de UF (reutilizada por products e profiles).
create or replace function public.is_valid_uf(p text)
returns boolean
language sql
immutable
as $$
  select p is null or p = any (array[
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
    'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ]);
$$;

-- --- Perfil: localizacao (publica) -------------------------------------------
alter table public.profiles
  add column if not exists city text,
  add column if not exists region_uf text;

alter table public.profiles drop constraint if exists profiles_region_uf_valid;
alter table public.profiles
  add constraint profiles_region_uf_valid check (public.is_valid_uf(region_uf));

-- O usuario pode editar a propria localizacao (a policy de update ja existe;
-- aqui concedemos o privilegio de coluna, como ja feito para full_name).
grant update (city, region_uf) on public.profiles to authenticated;

-- --- Perfil privado: ano de nascimento (PII) ---------------------------------
alter table public.profiles_private
  add column if not exists birth_year integer;

alter table public.profiles_private drop constraint if exists profiles_private_birth_year_chk;
alter table public.profiles_private
  add constraint profiles_private_birth_year_chk
  check (birth_year is null or (birth_year between 1900 and 2100));
-- profiles_private ja tem grant (select,insert,update,delete) para authenticated.

-- --- Produtos: regiao (UF) para o filtro -------------------------------------
alter table public.products
  add column if not exists region_uf text;

alter table public.products drop constraint if exists products_region_uf_valid;
alter table public.products
  add constraint products_region_uf_valid check (public.is_valid_uf(region_uf));

create index if not exists products_region_idx on public.products (region_uf) where status = 'ativo';
create index if not exists products_category_idx on public.products (category) where status = 'ativo';
create index if not exists products_title_lower_idx on public.products (lower(title));

-- A view products_with_split usa p.*; recriar para expor region_uf.
drop view if exists public.products_with_split;
create view public.products_with_split
with (security_invoker = true) as
select
  p.*,
  public.setting_int('platform_fee_bps', 500)::int as platform_fee_bps,
  floor(p.amount_total_cents * p.commission_bps / 10000.0)::bigint as commission_cents,
  floor(p.amount_total_cents * public.setting_int('platform_fee_bps', 500) / 10000.0)::bigint as platform_fee_cents,
  (p.amount_total_cents
    - floor(p.amount_total_cents * p.commission_bps / 10000.0)::bigint
    - floor(p.amount_total_cents * public.setting_int('platform_fee_bps', 500) / 10000.0)::bigint
  ) as seller_net_cents
from public.products p;

grant select on public.products_with_split to anon, authenticated;
