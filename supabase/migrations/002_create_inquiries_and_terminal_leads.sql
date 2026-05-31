create extension if not exists "pgcrypto";

-- Communication Hub / contact.html
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

-- Checkout Terminal / index.html
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
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'inquiries'
      and policyname = 'Allow server-side service insertions only'
  ) then
    create policy "Allow server-side service insertions only"
    on public.inquiries
    for insert
    to service_role
    with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'terminal_leads'
      and policyname = 'Allow server-side terminal service insertions only'
  ) then
    create policy "Allow server-side terminal service insertions only"
    on public.terminal_leads
    for insert
    to service_role
    with check (true);
  end if;
end
$$;

create index if not exists idx_inquiries_email on public.inquiries(email);
create index if not exists idx_terminal_leads_email on public.terminal_leads(email);
create index if not exists idx_inquiries_created_at on public.inquiries(created_at desc);
create index if not exists idx_terminal_leads_created_at on public.terminal_leads(created_at desc);
