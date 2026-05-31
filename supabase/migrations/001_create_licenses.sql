create extension if not exists "pgcrypto";

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  broker_id text not null,
  mt5_account text not null unique,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'confirmed', 'activated')),
  crypto_currency text not null default 'USDT_ERC20',
  crypto_network text not null default 'ERC20',
  wallet_address text not null,
  crypto_amount_expected numeric(12, 2) not null,
  unique_offset_cents integer not null,
  tx_hash text,
  created_at timestamptz not null default now()
);

create index if not exists licenses_payment_status_idx on public.licenses(payment_status);
create index if not exists licenses_email_idx on public.licenses(email);
