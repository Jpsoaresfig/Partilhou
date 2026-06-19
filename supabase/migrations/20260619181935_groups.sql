-- =============================================================================
-- 0021 — Grupos (comunidades de vendas e promocoes)
-- =============================================================================
-- Comunidades por tema ou regiao onde as pessoas compartilham achados, cupons e
-- links de oferta — de lojas externas OU de anuncios da propria Partilhou.
--
-- Modelo:
--   * groups            -> a comunidade (publica ou privada). Contadores de
--                          membros/posts sao denormalizados e mantidos por trigger.
--   * group_members     -> quem participa e com qual papel (admin/moderador/membro).
--   * group_posts       -> publicacoes: 'oferta' (link/produto) ou 'texto' (conversa).
--   * group_post_likes  -> curtidas (engajamento leve).
--
-- A UI ja existe (/grupos). Esta migration prepara o banco para a proxima fase:
-- entrar, postar ofertas e curtir, tudo controlado por RLS (sem RPC para os
-- fluxos basicos, igual ao chat). Funcoes SECURITY DEFINER ficam restritas ao
-- que precisa furar RLS (auto-admin do dono e contadores).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos (enums)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'group_visibility') then
    create type public.group_visibility as enum ('publico', 'privado');
  end if;

  if not exists (select 1 from pg_type where typname = 'group_member_role') then
    create type public.group_member_role as enum ('admin', 'moderador', 'membro');
  end if;

  if not exists (select 1 from pg_type where typname = 'group_theme') then
    create type public.group_theme as enum (
      'geral', 'promocoes', 'eletronicos', 'moda', 'casa', 'automotivo', 'regionais'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'group_post_kind') then
    create type public.group_post_kind as enum ('oferta', 'texto');
  end if;

  if not exists (select 1 from pg_type where typname = 'group_post_status') then
    create type public.group_post_status as enum ('visivel', 'removido');
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table if not exists public.groups (
  id            uuid primary key default gen_random_uuid(),
  -- slug usado na URL (/grupos/<slug>). Imutavel apos a criacao.
  slug          text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name          text not null check (length(trim(name)) between 3 and 80),
  description   text check (description is null or length(description) <= 500),
  icon          text not null default '📦' check (length(icon) <= 8),
  -- gradiente/cor da capa (string CSS). Opcional — a UI tem fallback.
  cover         text check (cover is null or length(cover) <= 200),
  theme         public.group_theme not null default 'geral',
  visibility    public.group_visibility not null default 'publico',
  -- UF para grupos regionais (validada pela funcao canonica). Null = sem regiao.
  region_uf     text,
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  -- Contadores denormalizados (mantidos por trigger). Nunca escritos pelo cliente.
  members_count integer not null default 0,
  posts_count   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint groups_region_uf_valid check (public.is_valid_uf(region_uf))
);

create index if not exists groups_theme_idx  on public.groups (visibility, theme, created_at desc);
create index if not exists groups_owner_idx  on public.groups (owner_id);
create index if not exists groups_region_idx on public.groups (region_uf) where region_uf is not null;

create table if not exists public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role       public.group_member_role not null default 'membro',
  joined_at  timestamptz not null default now(),
  primary key (group_id, profile_id)
);

-- "Meus grupos": lista os grupos de um usuario.
create index if not exists group_members_profile_idx on public.group_members (profile_id);

create table if not exists public.group_posts (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        public.group_post_kind not null default 'oferta',
  body        text check (body is null or length(body) <= 2000),
  -- Link da promocao (loja externa). Aceita apenas http(s).
  link_url    text check (link_url is null or link_url ~ '^https?://'),
  -- Quando a oferta e um anuncio da propria Partilhou.
  product_id  uuid references public.products (id) on delete set null,
  -- Preco opcional exibido no card da oferta (centavos, padrao da casa).
  price_cents bigint check (price_cents is null or price_cents >= 0),
  -- Nome da loja/origem ("Amazon", "Magalu", "Partilhou"...).
  store_name  text check (store_name is null or length(store_name) <= 80),
  status      public.group_post_status not null default 'visivel',
  likes_count integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Conteudo coerente com o tipo: texto exige corpo; oferta exige link OU produto.
  constraint group_posts_content check (
    (kind = 'texto'  and length(trim(coalesce(body, ''))) > 0)
    or (kind = 'oferta' and (link_url is not null or product_id is not null))
  )
);

create index if not exists group_posts_group_idx   on public.group_posts (group_id, created_at desc);
create index if not exists group_posts_author_idx  on public.group_posts (author_id);
create index if not exists group_posts_product_idx on public.group_posts (product_id) where product_id is not null;

create table if not exists public.group_post_likes (
  post_id    uuid not null references public.group_posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index if not exists group_post_likes_profile_idx on public.group_post_likes (profile_id);

-- -----------------------------------------------------------------------------
-- Helpers de pertencimento (usados nas policies de RLS).
--
-- Ficam em `public` (nao em `app`) e como SECURITY DEFINER de proposito: as
-- policies rodam no contexto do usuario (authenticated/anon), que NAO tem USAGE
-- em `app`. Alem disso, consultar group_members DENTRO da policy de group_members
-- causaria recursao infinita de RLS — o SECURITY DEFINER fura a RLS e quebra o
-- ciclo. As funcoes sao apenas-leitura e sem efeito colateral (mesmo racional do
-- public.setting_int / public.is_valid_uf).
-- -----------------------------------------------------------------------------
create or replace function public.is_group_member(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
     where m.group_id = p_group and m.profile_id = p_user
  );
$$;

create or replace function public.is_group_admin(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
     where m.group_id = p_group and m.profile_id = p_user and m.role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

-- Ao criar um grupo, o dono entra automaticamente como admin. SECURITY DEFINER
-- porque a insercao precisa furar a RLS de group_members (o dono ainda nao e
-- membro, entao a policy de "join" nao se aplicaria a ele).
create or replace function app.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, profile_id, role)
  values (new.id, new.owner_id, 'admin')
  on conflict (group_id, profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function app.handle_new_group();

-- updated_at coerente (reutiliza o helper generico da migration 0001).
drop trigger if exists touch_groups on public.groups;
create trigger touch_groups before update on public.groups
  for each row execute function app.touch_updated_at();

drop trigger if exists touch_group_posts on public.group_posts;
create trigger touch_group_posts before update on public.group_posts
  for each row execute function app.touch_updated_at();

-- Contador de membros.
create or replace function app.sync_group_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.groups set members_count = members_count + 1 where id = new.group_id;
  elsif tg_op = 'DELETE' then
    update public.groups set members_count = greatest(members_count - 1, 0) where id = old.group_id;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_member_count on public.group_members;
create trigger sync_member_count
  after insert or delete on public.group_members
  for each row execute function app.sync_group_member_count();

-- Contador de posts visiveis (considera soft-delete via status).
create or replace function app.sync_group_post_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'visivel' then
      update public.groups set posts_count = posts_count + 1 where id = new.group_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.status = 'visivel' then
      update public.groups set posts_count = greatest(posts_count - 1, 0) where id = old.group_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.status = 'visivel' and new.status <> 'visivel' then
      update public.groups set posts_count = greatest(posts_count - 1, 0) where id = new.group_id;
    elsif old.status <> 'visivel' and new.status = 'visivel' then
      update public.groups set posts_count = posts_count + 1 where id = new.group_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_post_count on public.group_posts;
create trigger sync_post_count
  after insert or update or delete on public.group_posts
  for each row execute function app.sync_group_post_count();

-- Contador de curtidas.
create or replace function app.sync_group_post_likes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.group_posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.group_posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_post_likes on public.group_post_likes;
create trigger sync_post_likes
  after insert or delete on public.group_post_likes
  for each row execute function app.sync_group_post_likes();

-- =============================================================================
-- RLS
-- =============================================================================

-- --- groups ------------------------------------------------------------------
alter table public.groups enable row level security;

-- Grupos publicos sao visiveis a todos; privados, so a membros.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select to anon, authenticated
  using (visibility = 'publico' or public.is_group_member(id, (select auth.uid())));

-- Qualquer autenticado cria um grupo, sendo o dono.
drop policy if exists groups_insert_owner on public.groups;
create policy groups_insert_owner on public.groups
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

-- Dono ou admin editam (as colunas editaveis sao limitadas pelo GRANT).
drop policy if exists groups_update_admin on public.groups;
create policy groups_update_admin on public.groups
  for update to authenticated
  using (owner_id = (select auth.uid()) or public.is_group_admin(id, (select auth.uid())))
  with check (owner_id = (select auth.uid()) or public.is_group_admin(id, (select auth.uid())));

-- Apenas o dono apaga o grupo.
drop policy if exists groups_delete_owner on public.groups;
create policy groups_delete_owner on public.groups
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- --- group_members -----------------------------------------------------------
alter table public.group_members enable row level security;

-- Membros de grupo publico sao visiveis a todos; de privado, so a outros membros.
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select to anon, authenticated
  using (
    exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'publico')
    or public.is_group_member(group_id, (select auth.uid()))
  );

-- Entrar: o proprio usuario, e somente em grupos publicos.
-- (O papel nao e concedido no GRANT, entao entra sempre como 'membro'.
--  O dono ja entra como admin via trigger. Convites para privados virao depois.)
drop policy if exists group_members_join on public.group_members;
create policy group_members_join on public.group_members
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'publico')
  );

-- Sair (o proprio) ou remover alguem (admin do grupo).
drop policy if exists group_members_leave on public.group_members;
create policy group_members_leave on public.group_members
  for delete to authenticated
  using (
    profile_id = (select auth.uid())
    or public.is_group_admin(group_id, (select auth.uid()))
  );

-- --- group_posts -------------------------------------------------------------
alter table public.group_posts enable row level security;

-- Posts visiveis de grupo publico -> todos; de privado -> membros.
drop policy if exists group_posts_select on public.group_posts;
create policy group_posts_select on public.group_posts
  for select to anon, authenticated
  using (
    status = 'visivel'
    and (
      exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'publico')
      or public.is_group_member(group_id, (select auth.uid()))
    )
  );

-- Postar: membro do grupo, escrevendo como ele mesmo.
drop policy if exists group_posts_insert_member on public.group_posts;
create policy group_posts_insert_member on public.group_posts
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );

-- Editar/moderar: autor do post ou admin do grupo.
drop policy if exists group_posts_update_own on public.group_posts;
create policy group_posts_update_own on public.group_posts
  for update to authenticated
  using (author_id = (select auth.uid()) or public.is_group_admin(group_id, (select auth.uid())))
  with check (author_id = (select auth.uid()) or public.is_group_admin(group_id, (select auth.uid())));

drop policy if exists group_posts_delete_own on public.group_posts;
create policy group_posts_delete_own on public.group_posts
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_group_admin(group_id, (select auth.uid())));

-- --- group_post_likes --------------------------------------------------------
alter table public.group_post_likes enable row level security;

drop policy if exists group_post_likes_select on public.group_post_likes;
create policy group_post_likes_select on public.group_post_likes
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.group_posts p
       join public.groups g on g.id = p.group_id
      where p.id = post_id
        and p.status = 'visivel'
        and (g.visibility = 'publico' or public.is_group_member(g.id, (select auth.uid())))
    )
  );

drop policy if exists group_post_likes_insert on public.group_post_likes;
create policy group_post_likes_insert on public.group_post_likes
  for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.group_posts p
       where p.id = post_id and public.is_group_member(p.group_id, (select auth.uid()))
    )
  );

drop policy if exists group_post_likes_delete on public.group_post_likes;
create policy group_post_likes_delete on public.group_post_likes
  for delete to authenticated
  using (profile_id = (select auth.uid()));

-- =============================================================================
-- Grants (defesa em profundidade — RLS filtra linhas; o GRANT controla o acesso
-- e limita as colunas escreviveis para proteger contadores, papel e dono).
-- =============================================================================
grant select on public.groups to anon, authenticated;
grant insert (slug, name, description, icon, cover, theme, visibility, region_uf, owner_id)
  on public.groups to authenticated;
grant update (name, description, icon, cover, theme, visibility, region_uf)
  on public.groups to authenticated;
grant delete on public.groups to authenticated;

grant select on public.group_members to anon, authenticated;
-- role omitido de proposito -> sempre entra como 'membro' (default).
grant insert (group_id, profile_id) on public.group_members to authenticated;
grant delete on public.group_members to authenticated;

grant select on public.group_posts to anon, authenticated;
grant insert (group_id, author_id, kind, body, link_url, product_id, price_cents, store_name, status)
  on public.group_posts to authenticated;
grant update (body, link_url, product_id, price_cents, store_name, status)
  on public.group_posts to authenticated;
grant delete on public.group_posts to authenticated;

grant select on public.group_post_likes to anon, authenticated;
grant insert (post_id, profile_id) on public.group_post_likes to authenticated;
grant delete on public.group_post_likes to authenticated;

grant execute on function public.is_group_member(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.is_group_admin(uuid, uuid)  to anon, authenticated, service_role;

comment on table public.groups is 'Comunidades de vendas e promocoes (publicas/privadas). Contadores via trigger.';
comment on table public.group_members is 'Pertencimento usuario<->grupo e papel.';
comment on table public.group_posts is 'Publicacoes: oferta (link/produto) ou texto.';
comment on table public.group_post_likes is 'Curtidas de posts (engajamento).';
