-- =============================================================================
-- 0009 — Liberacao automatica agendada (pg_cron) + papel de admin
-- =============================================================================

-- Papel de administrador/mediador. Guardado em app_metadata (NAO em
-- user_metadata, que e editavel pelo usuario). Verificado nas rotas de admin.
create or replace function app.is_admin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (raw_app_meta_data ->> 'is_admin')::boolean
       from auth.users where id = p_user),
    false
  );
$$;

-- Agenda o job de liberacao automatica a cada 10 minutos, se pg_cron existir.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Remove agendamento anterior (idempotente).
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'partilhou_auto_release';

    perform cron.schedule(
      'partilhou_auto_release',
      '*/10 * * * *',
      $job$ select app.auto_release_due(); $job$
    );
  else
    raise warning 'pg_cron indisponivel: agende app.auto_release_due() externamente (ex.: Edge Function + Scheduler).';
  end if;
end$$;
