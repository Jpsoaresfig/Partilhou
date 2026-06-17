-- =============================================================================
-- 0011 — Storage: bucket de imagens de produtos
-- =============================================================================
-- Bucket publico para leitura (vitrine), mas escrita restrita: cada usuario so
-- pode gravar/alterar/excluir dentro da sua propria pasta {auth.uid()}/...
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Leitura publica das imagens (catalogo visivel a todos).
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

-- Upload: apenas autenticado e dentro da propria pasta.
drop policy if exists "product_images_insert_own" on storage.objects;
create policy "product_images_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Update (necessario para upsert) na propria pasta.
drop policy if exists "product_images_update_own" on storage.objects;
create policy "product_images_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Delete na propria pasta.
drop policy if exists "product_images_delete_own" on storage.objects;
create policy "product_images_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
