-- ZoneX Bot · run once in Supabase → SQL Editor → New query → Run
-- https://supabase.com/dashboard/project/_/sql

-- 001 licenses
create extension if not exists "pgcrypto";

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  broker_id text not null,
  mt5_account text not null unique,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'confirmed', 'activated', 'revoked')),
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
create unique index if not exists idx_licenses_email_mt5 on public.licenses(email, mt5_account);
create index if not exists idx_licenses_id_status on public.licenses(id, payment_status);

-- 002 inquiries + terminal_leads
create table if not exists public.inquiries (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  full_name text not null,
  email text not null,
  broker_id text,
  message text not null,
  source_stream text default 'inquiry' not null,
  timestamp_utc text not null
);

create table if not exists public.terminal_leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  email text not null,
  broker_id text not null,
  mt5_account text not null,
  currency text default 'USD' not null,
  source_stream text default 'terminal' not null,
  timestamp_utc text not null
);

alter table public.inquiries enable row level security;
alter table public.terminal_leads enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inquiries'
      and policyname = 'Allow server-side service insertions only'
  ) then
    create policy "Allow server-side service insertions only"
    on public.inquiries for insert to service_role with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'terminal_leads'
      and policyname = 'Allow server-side terminal service insertions only'
  ) then
    create policy "Allow server-side terminal service insertions only"
    on public.terminal_leads for insert to service_role with check (true);
  end if;
end $$;

create index if not exists idx_inquiries_email on public.inquiries(email);
create index if not exists idx_terminal_leads_email on public.terminal_leads(email);
create index if not exists idx_inquiries_created_at on public.inquiries(created_at desc);
create index if not exists idx_terminal_leads_created_at on public.terminal_leads(created_at desc);
create unique index if not exists idx_terminal_leads_mt5_unique on public.terminal_leads(mt5_account);

-- 003 fulfillment columns
alter table public.terminal_leads
  add column if not exists payment_status text default 'PENDING',
  add column if not exists access_granted boolean default false,
  add column if not exists transaction_hash text,
  add column if not exists activation_token char(16);

create unique index if not exists idx_terminal_leads_activation_token
  on public.terminal_leads (activation_token)
  where activation_token is not null;

create index if not exists idx_terminal_leads_runtime_v2
  on public.terminal_leads (mt5_account)
  where payment_status = 'CONFIRMED' and access_granted = true;

create table if not exists public.processed_webhook_events (
  id text primary key,
  processed_at timestamptz not null default now()
);

create index if not exists idx_processed_webhook_events_at
  on public.processed_webhook_events (processed_at desc);

-- 004 atomic fulfillment RPC (webhook path)
create or replace function public.fulfill_payment(
  p_event_id text,
  p_email text,
  p_mt5 text,
  p_token char(16),
  p_tx_hash text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  lic_rows int;
  lead_rows int;
begin
  if exists (select 1 from public.processed_webhook_events where id = p_event_id) then
    return false;
  end if;

  update public.licenses
  set payment_status = 'confirmed', tx_hash = p_tx_hash
  where email = p_email and mt5_account = p_mt5;

  get diagnostics lic_rows = row_count;

  update public.terminal_leads
  set payment_status = 'CONFIRMED',
      access_granted = true,
      transaction_hash = p_tx_hash,
      activation_token = p_token
  where email = p_email and mt5_account = p_mt5;

  get diagnostics lead_rows = row_count;

  if lic_rows = 0 or lead_rows = 0 then
    raise exception 'Fulfillment rejected: Critical identity mismatch for email % and MT5 %', p_email, p_mt5;
  end if;

  insert into public.processed_webhook_events (id) values (p_event_id);

  return true;
end;
$$;

revoke all on function public.fulfill_payment(text, text, text, char, text) from public;
grant execute on function public.fulfill_payment(text, text, text, char, text) to service_role;
