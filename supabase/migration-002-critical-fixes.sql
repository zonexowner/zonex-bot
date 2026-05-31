-- ZoneX Bot · critical payment/fulfillment fixes
-- Run in Supabase SQL Editor after setup.sql (safe to re-run)

-- 1. Allow revoked status on licenses
ALTER TABLE public.licenses
  DROP CONSTRAINT IF EXISTS licenses_payment_status_check;

ALTER TABLE public.licenses
  ADD CONSTRAINT licenses_payment_status_check
  CHECK (payment_status IN ('pending', 'confirmed', 'activated', 'revoked'));

-- 2. Persist activation token for O(1) download lookup
ALTER TABLE public.terminal_leads
  ADD COLUMN IF NOT EXISTS activation_token CHAR(16);

CREATE UNIQUE INDEX IF NOT EXISTS idx_terminal_leads_activation_token
  ON public.terminal_leads (activation_token)
  WHERE activation_token IS NOT NULL;

-- 3. Heartbeat / verify hot path
CREATE INDEX IF NOT EXISTS idx_terminal_leads_runtime_v2
  ON public.terminal_leads (mt5_account)
  WHERE payment_status = 'CONFIRMED' AND access_granted = true;

-- 4. Webhook + admin composite lookup on licenses
CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_email_mt5
  ON public.licenses (email, mt5_account);

-- 5. Checkout status polling
CREATE INDEX IF NOT EXISTS idx_licenses_id_status
  ON public.licenses (id, payment_status);

-- 6. Webhook idempotency dedupe table
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_events_at
  ON public.processed_webhook_events (processed_at DESC);
