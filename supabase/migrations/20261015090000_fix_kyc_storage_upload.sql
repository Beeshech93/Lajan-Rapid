-- Keep KYC documents private and allow common image formats up to 8 MiB.
-- Safe to rerun: bucket settings are upserted and policies are recreated idempotently.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kyc_docs_insert_own" on storage.objects;
create policy "kyc_docs_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'kyc-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "kyc_docs_select_own_or_staff" on storage.objects;
create policy "kyc_docs_select_own_or_staff"
on storage.objects for select to authenticated
using (
  bucket_id = 'kyc-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_staff((select auth.uid()))
  )
);
