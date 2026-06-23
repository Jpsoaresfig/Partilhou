-- =============================================================================
-- Seed de DEMONSTRACAO (aplicado por `supabase db reset`)
-- =============================================================================
-- Cria contas de teste, anuncios ativos e links de afiliado para que a loja
-- abra populada. NAO use estes dados/segredos em producao.
--
-- Contas (senha de todas: "Senha12345"):
--   vendedor@demo.com   -> tem 3 anuncios ativos
--   afiliado@demo.com   -> tem links de afiliado prontos
--   comprador@demo.com  -> compra os anuncios
--   admin@demo.com      -> mediador (is_admin em app_metadata)
--   admin@partilhou.app -> mediador (conta admin "oficial", is_admin)
--
-- Os profiles e wallets sao criados automaticamente pelo trigger
-- app.handle_new_user() ao inserir em auth.users.
-- =============================================================================

-- UUIDs fixos para podermos referenciar nos inserts seguintes.
-- vendedor : 11111111-1111-1111-1111-111111111111
-- afiliado : 22222222-2222-2222-2222-222222222222
-- comprador: 33333333-3333-3333-3333-333333333333
-- admin    : 44444444-4444-4444-4444-444444444444
-- admin app: 55555555-5555-5555-5555-555555555555

do $$
declare
  r record;
  v_users jsonb := jsonb_build_array(
    jsonb_build_object('id','11111111-1111-1111-1111-111111111111','email','vendedor@demo.com','name','Marina Vendedora','admin',false),
    jsonb_build_object('id','22222222-2222-2222-2222-222222222222','email','afiliado@demo.com','name','Bruno Afiliado','admin',false),
    jsonb_build_object('id','33333333-3333-3333-3333-333333333333','email','comprador@demo.com','name','Carla Compradora','admin',false),
    jsonb_build_object('id','44444444-4444-4444-4444-444444444444','email','admin@demo.com','name','Admin Partilhou','admin',true),
    jsonb_build_object('id','55555555-5555-5555-5555-555555555555','email','admin@partilhou.app','name','Admin Partilhou','admin',true)
  );
begin
  for r in select * from jsonb_array_elements(v_users) as u(obj)
  loop
    -- Usuario no GoTrue (auth.users). Senha via bcrypt; e-mail ja confirmado.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      (r.obj->>'id')::uuid,
      'authenticated',
      'authenticated',
      r.obj->>'email',
      crypt('Senha12345', gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email'))
        || case when (r.obj->>'admin')::boolean then '{"is_admin":true}'::jsonb else '{}'::jsonb end,
      jsonb_build_object('full_name', r.obj->>'name'),
      now(), now(), '', '', '', ''
    )
    on conflict (id) do nothing;

    -- Identidade de e-mail (necessaria para login por senha em versoes recentes do GoTrue).
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      r.obj->>'id',
      (r.obj->>'id')::uuid,
      jsonb_build_object('sub', r.obj->>'id', 'email', r.obj->>'email', 'email_verified', true),
      'email',
      now(), now(), now()
    )
    on conflict do nothing;
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- Anuncios do vendedor (status ativo). Comissao em basis points.
-- ---------------------------------------------------------------------------
-- Ja entram 'approved' (com score) para a loja abrir populada. Anuncios reais
-- nascem 'pending_review' e passam pela moderacao do admin.
insert into public.products (id, seller_id, title, description, images, amount_total_cents, commission_bps, status, imei, review_status, trust_score)
values
  (
    'aaaaaaa1-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'iPhone 12 128GB (usado, impecavel)',
    E'Bateria 89%. Sem riscos na tela. Acompanha cabo e caixa.\nEntrega para todo o Brasil.',
    array['https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=800'],
    180000, 1000, 'ativo', '356938035643809', 'approved', 90
  ),
  (
    'aaaaaaa1-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    'Bicicleta Caloi Aro 29 (seminova)',
    E'Usada poucas vezes. Freios a disco, 21 marchas. Revisada.',
    array['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800'],
    95000, 1500, 'ativo', null, 'partial', 60
  ),
  (
    'aaaaaaa1-0000-0000-0000-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'Cadeira Gamer ThunderX3 (preta/vermelha)',
    E'Reclinavel, apoio lombar. Pequeno desgaste no apoio de braco.',
    array['https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800'],
    52000, 1200, 'ativo', null, 'unverified', 35
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Links de afiliado prontos (Bruno promove os anuncios da Marina).
-- ---------------------------------------------------------------------------
insert into public.affiliate_links (id, affiliate_id, product_id, tracking_code)
values
  ('bbbbbbb1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-0000-0000-000000000001','demoiphone01'),
  ('bbbbbbb1-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','aaaaaaa1-0000-0000-0000-000000000002','democaloi002')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Grupos de demonstracao (comunidades de vendas/promocoes). Dono = admin oficial.
-- O trigger app.handle_new_group() ja inscreve o dono como admin (members_count=1).
-- ---------------------------------------------------------------------------
insert into public.groups (id, slug, name, description, theme, region_uf, owner_id)
values
  ('99999991-0000-0000-0000-000000000001','achados-e-promocoes','Achados e Promocoes',
   'A galera compartilha cupons, ofertas relampago e quedas de preco. Postou um achado bom? Solta aqui.',
   'promocoes', null, '55555555-5555-5555-5555-555555555555'),
  ('99999991-0000-0000-0000-000000000002','tech-e-gadgets','Tech & Gadgets',
   'Celulares, fones, consoles e perifericos. Comparativos, reviews e links de promocao de eletronicos.',
   'eletronicos', null, '55555555-5555-5555-5555-555555555555'),
  ('99999991-0000-0000-0000-000000000003','moda-e-desapego','Moda & Desapego',
   'Roupas, tenis e acessorios novos e seminovos. Brecho coletivo e promocoes das lojas parceiras.',
   'moda', null, '55555555-5555-5555-5555-555555555555'),
  ('99999991-0000-0000-0000-000000000004','casa-e-decoracao','Casa & Decoracao',
   'Moveis, eletrodomesticos e itens de decoracao. Ofertas para montar ou renovar o lar gastando pouco.',
   'casa', null, '55555555-5555-5555-5555-555555555555'),
  ('99999991-0000-0000-0000-000000000005','carros-e-pecas','Carros & Pecas',
   'Veiculos, pecas e acessorios automotivos. Promocoes de oficina, pneus e som — e indicacoes da comunidade.',
   'automotivo', null, '55555555-5555-5555-5555-555555555555'),
  ('99999991-0000-0000-0000-000000000006','promocoes-sao-paulo','Promocoes Sao Paulo',
   'Ofertas, feiras e desapegos da regiao de SP. Combine retirada na mao e economize no frete.',
   'regionais', 'SP', '55555555-5555-5555-5555-555555555555')
on conflict (id) do nothing;

-- Alguns membros de demonstracao entram nos dois grupos mais ativos.
insert into public.group_members (group_id, profile_id)
values
  ('99999991-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111'),
  ('99999991-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222'),
  ('99999991-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333'),
  ('99999991-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222'),
  ('99999991-0000-0000-0000-000000000002','33333333-3333-3333-3333-333333333333')
on conflict do nothing;

-- Um post de oferta de exemplo no grupo de promocoes (link externo).
insert into public.group_posts (id, group_id, author_id, kind, body, link_url, store_name)
values
  ('99999992-0000-0000-0000-000000000001','99999991-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222','oferta',
   'Fone bluetooth com 40% off, achei pouca gente sabendo!',
   'https://exemplo.com/oferta-fone','Loja Exemplo')
on conflict (id) do nothing;
