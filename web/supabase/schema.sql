-- Budget Agent schema
-- Run this in Supabase SQL editor.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date date not null,
  merchant text not null,
  amount numeric not null,
  category text,
  source text not null check (source in ('receipt','chat')),
  receipt_url text,
  created_at timestamptz not null default now()
);

-- Index for fast dashboard queries
create index if not exists idx_transactions_user_date
  on public.transactions (user_id, date desc);

-- (Hackathon) RLS off for speed; for production enable RLS and add policies.
alter table public.transactions disable row level security;
