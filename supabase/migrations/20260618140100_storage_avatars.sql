-- =============================================================================
-- 0017 — Storage: bucket de fotos de loja (avatars)
-- =============================================================================
-- Mesma politica do bucket de produtos: leitura publica (a foto aparece na loja
-- e nos anuncios), escrita restrita a propria pasta {auth.uid()}/...
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Leitura publica.
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

-- Upload na propria pasta.
drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Update (upsert) na propria pasta.
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Delete na propria pasta.
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
