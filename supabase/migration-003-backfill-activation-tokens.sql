-- ZoneX Bot · backfill activation_token for existing confirmed leads
-- Run AFTER migration-002-critical-fixes.sql
-- Token formula matches server.js buildActivationToken(): first 16 hex chars of
-- sha256(mt5_account || '-' || transaction_hash), uppercased.

UPDATE public.terminal_leads
SET activation_token = UPPER(SUBSTRING(
  encode(digest(mt5_account || '-' || COALESCE(transaction_hash, 'MOCK_TX_VALIDATED'), 'sha256'), 'hex')
  FROM 1 FOR 16
))
WHERE access_granted = true
  AND payment_status = 'CONFIRMED'
  AND transaction_hash IS NOT NULL
  AND activation_token IS NULL;
