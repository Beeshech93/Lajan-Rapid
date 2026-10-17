ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS receipt_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('transaction-receipts', 'transaction-receipts', false, 8388608,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 8388608,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf'];

DROP POLICY IF EXISTS "transaction_receipts_insert_owner" ON storage.objects;
CREATE POLICY "transaction_receipts_insert_owner" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'transaction-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.transfers t WHERE t.id::text = (storage.foldername(name))[2] AND t.user_id = auth.uid())
);

DROP POLICY IF EXISTS "transaction_receipts_select_owner_or_staff" ON storage.objects;
CREATE POLICY "transaction_receipts_select_owner_or_staff" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'transaction-receipts'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid()))
);

DROP POLICY IF EXISTS "transaction_receipts_delete_owner_or_staff" ON storage.objects;
CREATE POLICY "transaction_receipts_delete_owner_or_staff" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'transaction-receipts'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid()))
);
