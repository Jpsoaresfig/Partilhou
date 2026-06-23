-- =============================================================================
-- 0022 — Reportar problemas (suporte)
-- =============================================================================
-- Caixa de reports enviada pelo formulario /reportar. Aceita usuarios logados
-- (user_id preenchido) e visitantes (user_id nulo + email opcional). A escrita
-- acontece SEMPRE pelo servidor (route handler) com service_role; por isso a
-- tabela nao concede grants ao cliente e mantem RLS habilitada sem policies de
-- cliente (apenas o service_role e o admin, via funcoes definer, acessam).
-- =============================================================================

create table if not exists public.problem_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  email      text,
  category   text not null default 'outro',     -- pagamento | conta | anuncio | bug | abuso | outro
  message    text not null,
  url        text,                              -- pagina onde ocorreu (opcional)
  status     text not null default 'aberto',    -- aberto | resolvido
  created_at timestamptz not null default now()
);

-- Lista do admin: mais recentes primeiro, abertos em destaque.
create index if not exists problem_reports_created_idx
  on public.problem_reports (created_at desc);
create index if not exists problem_reports_open_idx
  on public.problem_reports (created_at desc) where status = 'aberto';

-- RLS ligada e sem policies de cliente: ninguem le/escreve via anon/authenticated.
-- O servidor usa service_role (bypass de RLS) para inserir e o admin para ler.
alter table public.problem_reports enable row level security;
