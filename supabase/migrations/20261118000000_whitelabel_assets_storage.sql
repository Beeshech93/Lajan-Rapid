-- Storage público para logotipos y favicons de marcas White Label
insert into storage.buckets (id, name, public)
values ('whitelabel-assets', 'whitelabel-assets', true)
on conflict (id) do nothing;

CREATE POLICY "whitelabel_assets_insert_staff" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'whitelabel-assets' AND public.is_staff(auth.uid()));

CREATE POLICY "whitelabel_assets_update_staff" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'whitelabel-assets' AND public.is_staff(auth.uid()));

CREATE POLICY "whitelabel_assets_delete_staff" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'whitelabel-assets' AND public.is_staff(auth.uid()));

-- Bucket público: lectura libre para mostrar logos y favicons en la web y PWA
CREATE POLICY "whitelabel_assets_select_public" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'whitelabel-assets');

