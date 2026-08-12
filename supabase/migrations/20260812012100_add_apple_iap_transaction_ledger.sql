-- Apple IAP ownership and fulfillment ledger.
-- A StoreKit transaction may be fulfilled for exactly one Loombus account.

alter table public.ai_extra_credit_packs
  drop constraint if exists ai_extra_credit_packs_source_check;

alter table public.ai_extra_credit_packs
  add constraint ai_extra_credit_packs_source_check
  check (source = any (array['stripe'::text, 'apple'::text, 'admin'::text, 'system'::text]));

create table if not exists public.apple_iap_transactions (
  transaction_id text primary key,
  original_transaction_id text,
  user_id uuid not null references auth.users(id) on delete restrict,
  product_id text not null,
  environment text not null
    check (environment in ('Production', 'Sandbox')),
  app_account_token uuid,
  purchase_date timestamptz,
  expires_date timestamptz,
  revocation_date timestamptz,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apple_iap_transactions_user_id_idx
  on public.apple_iap_transactions (user_id, created_at desc);

create index if not exists apple_iap_transactions_original_transaction_idx
  on public.apple_iap_transactions (original_transaction_id)
  where original_transaction_id is not null;

alter table public.apple_iap_transactions enable row level security;

revoke all on table public.apple_iap_transactions from anon;
revoke insert, update, delete on table public.apple_iap_transactions from authenticated;
grant select on table public.apple_iap_transactions to authenticated;

drop policy if exists "Members can read own Apple IAP transactions" on public.apple_iap_transactions;
create policy "Members can read own Apple IAP transactions"
  on public.apple_iap_transactions
  for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.apple_iap_transactions is
  'Server-verified Apple IAP transactions. transaction_id is globally unique so one StoreKit purchase cannot be claimed by multiple Loombus accounts.';
