-- Keep Bazik payout schema in Supabase's canonical migration chain.
-- The same change existed under drizzle/migrations, but Supabase deployments
-- need this migration when the Supabase CLI is the database migration runner.
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS bazik_provider TEXT,
  ADD COLUMN IF NOT EXISTS bazik_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS bazik_status TEXT,
  ADD COLUMN IF NOT EXISTS bazik_error TEXT,
  ADD COLUMN IF NOT EXISTS bazik_submitted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS transfers_bazik_transaction_id_uq
  ON public.transfers (bazik_transaction_id)
  WHERE bazik_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transfers_bazik_status_idx
  ON public.transfers (bazik_status)
  WHERE bazik_status IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_bazik_payout(
  _transfer_id UUID,
  _from_status public.transfer_status
)
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

REVOKE ALL ON FUNCTION public.claim_bazik_payout(UUID, public.transfer_status)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bazik_payout(UUID, public.transfer_status)
  TO service_role;
