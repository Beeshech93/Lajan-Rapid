-- KYC security hardening:
-- 1) Admin/staff can view files in the private KYC bucket using signed URLs.
-- 2) Clients cannot create a new KYC submission after any of their submissions is approved.
-- 3) Clients cannot update/delete submissions; existing policies keep review updates staff-only.

DROP POLICY IF EXISTS "kyc_documents_select_staff" ON storage.objects;
CREATE POLICY "kyc_documents_select_staff"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND public.is_staff(auth.uid())
);

CREATE OR REPLACE FUNCTION public.prevent_kyc_resubmission_after_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.kyc_submissions existing
    WHERE existing.user_id = NEW.user_id
      AND existing.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'KYC_ALREADY_APPROVED'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_kyc_resubmission_after_approval
ON public.kyc_submissions;

CREATE TRIGGER prevent_kyc_resubmission_after_approval
BEFORE INSERT ON public.kyc_submissions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_kyc_resubmission_after_approval();

-- Ensure users cannot directly change or delete their KYC records.
DROP POLICY IF EXISTS "kyc_update_admin" ON public.kyc_submissions;
CREATE POLICY "kyc_update_admin"
ON public.kyc_submissions
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "kyc_delete_admin" ON public.kyc_submissions;
CREATE POLICY "kyc_delete_admin"
ON public.kyc_submissions
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
