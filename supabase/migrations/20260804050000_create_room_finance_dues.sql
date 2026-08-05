create table if not exists public.room_finance_invoices (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  member_id uuid not null,
  created_by uuid not null,
  title text not null,
  description text,
  invoice_type text not null default 'dues',
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'USD',
  due_at timestamptz,
  status text not null default 'open',
  waived_at timestamptz,
  waived_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_finance_invoices add column if not exists room_id uuid;
alter table public.room_finance_invoices add column if not exists member_id uuid;
alter table public.room_finance_invoices add column if not exists created_by uuid;
alter table public.room_finance_invoices add column if not exists title text;
alter table public.room_finance_invoices add column if not exists description text;
alter table public.room_finance_invoices add column if not exists invoice_type text default 'dues';
alter table public.room_finance_invoices add column if not exists amount_cents bigint default 0;
alter table public.room_finance_invoices add column if not exists currency text default 'USD';
alter table public.room_finance_invoices add column if not exists due_at timestamptz;
alter table public.room_finance_invoices add column if not exists status text default 'open';
alter table public.room_finance_invoices add column if not exists waived_at timestamptz;
alter table public.room_finance_invoices add column if not exists waived_by uuid;
alter table public.room_finance_invoices add column if not exists created_at timestamptz default now();
alter table public.room_finance_invoices add column if not exists updated_at timestamptz default now();

create index if not exists room_finance_invoices_room_status_idx on public.room_finance_invoices(room_id, status, due_at, created_at desc);
create index if not exists room_finance_invoices_member_idx on public.room_finance_invoices(room_id, member_id, created_at desc);

create table if not exists public.room_finance_payments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  invoice_id uuid not null references public.room_finance_invoices(id) on delete cascade,
  member_id uuid not null,
  recorded_by uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD',
  method text not null default 'manual',
  reference text,
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.room_finance_payments add column if not exists room_id uuid;
alter table public.room_finance_payments add column if not exists invoice_id uuid;
alter table public.room_finance_payments add column if not exists member_id uuid;
alter table public.room_finance_payments add column if not exists recorded_by uuid;
alter table public.room_finance_payments add column if not exists amount_cents bigint default 0;
alter table public.room_finance_payments add column if not exists currency text default 'USD';
alter table public.room_finance_payments add column if not exists method text default 'manual';
alter table public.room_finance_payments add column if not exists reference text;
alter table public.room_finance_payments add column if not exists note text;
alter table public.room_finance_payments add column if not exists paid_at timestamptz default now();
alter table public.room_finance_payments add column if not exists created_at timestamptz default now();

create index if not exists room_finance_payments_invoice_idx on public.room_finance_payments(invoice_id, paid_at desc);
create index if not exists room_finance_payments_room_idx on public.room_finance_payments(room_id, created_at desc);

alter table public.room_finance_invoices enable row level security;
alter table public.room_finance_payments enable row level security;
revoke all on public.room_finance_invoices from anon, authenticated;
revoke all on public.room_finance_payments from anon, authenticated;
grant all on public.room_finance_invoices to service_role;
grant all on public.room_finance_payments to service_role;