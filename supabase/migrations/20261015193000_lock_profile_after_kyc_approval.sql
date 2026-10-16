-- Prevent clients from changing personal identity/contact fields after KYC approval.
-- Admin/staff can still correct profile details when necessary.
CREATE OR REPLACE FUNCTION public.prevent_profile_edit_after_kyc_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.kyc_status = 'approved'
     AND auth.uid() = OLD.id
     AND NOT public.is_staff(auth.uid())
     AND (
       NEW.full_name IS DISTINCT FROM OLD.full_name
       OR NEW.phone IS DISTINCT FROM OLD.phone
     )
  THEN
    RAISE EXCEPTION 'PROFILE_LOCKED_AFTER_KYC_APPROVAL'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_edit_after_kyc_approval
ON public.profiles;

CREATE TRIGGER prevent_profile_edit_after_kyc_approval
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_edit_after_kyc_approval();
