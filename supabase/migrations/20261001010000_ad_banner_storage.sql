-- Storage público para las imágenes del banner de publicidad.
-- El texto/link/estado del banner se guardan en integration_credentials
-- (mismo patrón que support.functions.ts), solo la imagen necesita un bucket.
insert into storage.buckets (id, name, public)
values ('ad-banner', 'ad-banner', true)
on conflict (id) do nothing;

CREATE POLICY "ad_banner_insert_staff" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-banner' AND public.is_staff(auth.uid()));

CREATE POLICY "ad_banner_update_staff" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ad-banner' AND public.is_staff(auth.uid()));

CREATE POLICY "ad_banner_delete_staff" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ad-banner' AND public.is_staff(auth.uid()));

-- Bucket público: cualquiera puede leer las imágenes (se muestran en
-- landing pages sin sesión), igual que cualquier otro bucket "public".
CREATE POLICY "ad_banner_select_public" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'ad-banner');
