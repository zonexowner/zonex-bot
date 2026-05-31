alter table public.terminal_leads
  add column if not exists payment_status text default 'PENDING',
  add column if not exists access_granted boolean default false,
  add column if not exists transaction_hash text;
