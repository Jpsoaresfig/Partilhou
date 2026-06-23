-- 0024 — Feature flag da area de Grupos.
--
-- Os Grupos (comunidades) ficam OCULTOS por padrao. O admin liga/desliga pelo
-- painel quando quiser. Guardado em platform_settings (key/value, texto).
-- value 'true' = visivel; qualquer outra coisa = oculto.

insert into public.platform_settings (key, value, description)
values (
  'groups_enabled',
  'false',
  'Liga/desliga a area de Grupos (comunidades) no site. true = visivel.'
)
on conflict (key) do nothing;
