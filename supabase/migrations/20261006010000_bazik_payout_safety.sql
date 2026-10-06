-- Bazik payout safety metadata.
-- These fields prevent concurrent payout attempts and preserve provider state
-- for reconciliation when a network timeout leaves the outcome unknown.

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

COMMENT ON COLUMN public.transfers.bazik_status IS
  'Provider state: submitting, pending, processing, succeeded, failed, unknown.';

COMMENT ON COLUMN public.transfers.bazik_transaction_id IS
  'Provider transaction id returned by Bazik; unique when present.';
