-- ZoneX Bot · atomic fulfillment RPC (webhook path)
-- Run AFTER migration-002-critical-fixes.sql

CREATE OR REPLACE FUNCTION public.fulfill_payment(
  p_event_id TEXT,
  p_email TEXT,
  p_mt5 TEXT,
  p_token CHAR(16),
  p_tx_hash TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lic_rows INT;
  lead_rows INT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.processed_webhook_events WHERE id = p_event_id) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.licenses
  SET payment_status = 'confirmed', tx_hash = p_tx_hash
  WHERE email = p_email AND mt5_account = p_mt5;

  GET DIAGNOSTICS lic_rows = ROW_COUNT;

  UPDATE public.terminal_leads
  SET payment_status = 'CONFIRMED',
      access_granted = true,
      transaction_hash = p_tx_hash,
      activation_token = p_token
  WHERE email = p_email AND mt5_account = p_mt5;

  GET DIAGNOSTICS lead_rows = ROW_COUNT;

  IF lic_rows = 0 OR lead_rows = 0 THEN
    RAISE EXCEPTION 'Fulfillment rejected: Critical identity mismatch for email % and MT5 %', p_email, p_mt5;
  END IF;

  INSERT INTO public.processed_webhook_events (id) VALUES (p_event_id);

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_payment(TEXT, TEXT, TEXT, CHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_payment(TEXT, TEXT, TEXT, CHAR, TEXT) TO service_role;
