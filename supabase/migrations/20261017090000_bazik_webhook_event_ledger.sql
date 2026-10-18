-- Durable idempotency ledger for Bazik payout webhooks.
-- Store identifiers and processing state only; do not persist raw payloads or secrets.
CREATE TABLE IF NOT EXISTS public.bazik_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'live')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  transfer_reference TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'processing'
    CHECK (processing_status IN ('processing', 'processed', 'retryable_failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  last_error TEXT,
  CONSTRAINT bazik_webhook_events_environment_event_id_uq UNIQUE (environment, event_id)
);

CREATE INDEX IF NOT EXISTS bazik_webhook_events_reference_idx
  ON public.bazik_webhook_events (transfer_reference, received_at DESC);

ALTER TABLE public.bazik_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bazik_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.bazik_webhook_events TO service_role;
