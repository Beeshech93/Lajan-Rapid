-- Persistent idempotency ledger for authenticated Bazik payout webhooks.
-- Access is server-only; the application uses the Supabase service-role client.
create table if not exists public.bazik_webhook_events (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('sandbox', 'live')),
  event_id text not null,
  event_type text not null,
  transfer_reference text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'retryable_failed')),
  processing_started_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  constraint bazik_webhook_events_environment_event_id_key unique (environment, event_id)
);

create index if not exists bazik_webhook_events_reference_idx
  on public.bazik_webhook_events (transfer_reference);

alter table public.bazik_webhook_events enable row level security;

revoke all on table public.bazik_webhook_events from anon, authenticated;
