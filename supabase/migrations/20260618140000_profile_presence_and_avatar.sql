-- =============================================================================
-- 0016 — Perfil: foto da loja (avatar) e presenca (last_seen_at)
-- =============================================================================
-- Dois sinais publicos da loja:
--   * avatar_url    -> foto da loja (bucket `avatars`, ver migration seguinte).
--   * last_seen_at  -> ultima atividade, para o indicador "Online / visto ha X".
-- Ambos vivem em public.profiles (legivel por autenticados) e sao editaveis
-- apenas pelo dono (policy profiles_update_own ja existente).
-- =============================================================================

alter table public.profiles
  add column if not exists avatar_url   text,
  add column if not exists last_seen_at timestamptz;

-- O dono pode definir a propria foto (a policy de update ja restringe a linha;
-- aqui concedemos o privilegio de coluna, como feito para full_name/city).
grant update (avatar_url) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- touch_presence: marca o usuario logado como ativo "agora".
-- SECURITY DEFINER para escrever sem depender de grants finos, com guarda de
-- frequencia (so grava se passou > 1 min) para evitar 1 write por navegacao.
-- last_seen_at NAO esta no grant de coluna acima de proposito: so muda por aqui.
-- -----------------------------------------------------------------------------
create or replace function public.touch_presence()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set last_seen_at = now()
   where id = (select auth.uid())
     and (last_seen_at is null or last_seen_at < now() - interval '1 minute');
$$;

revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;
