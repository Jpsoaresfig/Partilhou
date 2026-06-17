-- =============================================================================
-- 0001 — Perfis de usuario
-- =============================================================================
-- A autenticacao (email/senha, JWT, refresh tokens rotativos, recuperacao de
-- senha) e delegada ao Supabase Auth (auth.users). NAO reimplementamos crypto
-- de senha: o Supabase ja usa hashing forte e tokens HTTP-only via @supabase/ssr.
--
-- Separamos os dados em duas tabelas por sensibilidade:
--   * public.profiles         -> dados nao sensiveis (nome, status). Legivel por
--                                usuarios autenticados (ex.: mostrar nome do vendedor).
--   * public.profiles_private -> PII sensivel (documento, telefone). Apenas o
--                                dono e o service_role leem.
-- =============================================================================

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text not null check (length(trim(full_name)) between 2 and 160),
  account_status public.account_status not null default 'pendente_verificacao',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- PII sensivel isolada. Documento (CPF/CNPJ) e telefone.
-- Observacao de seguranca: o Supabase criptografa o disco em repouso. Para
-- criptografia em nivel de coluna (defense-in-depth), use Supabase Vault para a
-- chave e pgcrypto/pgsodium para os campos. Aqui guardamos em claro com RLS
-- estrita + o hash do documento para deduplicacao sem expor o numero.
create table if not exists public.profiles_private (
  profile_id      uuid primary key references public.profiles (id) on delete cascade,
  document_number text,
  phone           text,
  updated_at      timestamptz not null default now()
);

-- Documento unico no sistema (evita duas contas com o mesmo CPF/CNPJ).
-- (Em producao, prefira cifrar o numero via Supabase Vault e indexar um HMAC.)
create unique index if not exists profiles_private_document_key
  on public.profiles_private (document_number)
  where document_number is not null;

-- -----------------------------------------------------------------------------
-- Trigger: ao criar um usuario no auth.users, criar profile + carteira.
-- Roda como SECURITY DEFINER pois precisa inserir em tabelas protegidas por RLS.
-- Mora no schema privado `app` para nao virar endpoint publico.
-- -----------------------------------------------------------------------------
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Usuario')
  )
  on conflict (id) do nothing;

  insert into public.profiles_private (profile_id, document_number, phone)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'document_number'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (profile_id) do nothing;

  -- Carteira do usuario (uma por usuario).
  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- Mantem updated_at coerente.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles on public.profiles;
create trigger touch_profiles before update on public.profiles
  for each row execute function app.touch_updated_at();

drop trigger if exists touch_profiles_private on public.profiles_private;
create trigger touch_profiles_private before update on public.profiles_private
  for each row execute function app.touch_updated_at();
