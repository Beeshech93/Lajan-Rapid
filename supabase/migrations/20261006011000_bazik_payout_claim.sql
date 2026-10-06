-- Prevent concurrent duplicate provider submissions.
CREATE OR REPLACE FUNCTION public.claim_bazik_payout(_transfer_id UUID, _from_status public.transfer_status)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.transfers
     SET status = 'processing'::public.transfer_status,
         bazik_status = 'submitting',
         bazik_submitted_at = now(),
         bazik_error = NULL
   WHERE id = _transfer_id
     AND status = _from_status
     AND delivery_method IN ('moncash', 'natcash');

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_bazik_payout(UUID, public.transfer_status) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bazik_payout(UUID, public.transfer_status) TO service_role;
