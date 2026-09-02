-- Loombus Library checkout + entitlement hardening.
--
-- Adds a server-only checkout reservation snapshot so Stripe sessions are
-- idempotent without coupling fulfillment to an author's later price changes.
-- Also makes normalized publication section SELECT access fail closed for paid
-- publications at the database layer.

create table if not exists public.library_book_checkout_reservations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete restrict,
  amount_cents integer not null,
  currency text not null,
  platform_fee_cents integer not null,
  stripe_checkout_session_id text,
  checkout_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_book_checkout_reservations_amount_check check (amount_cents between 100 and 100000),
  constraint library_book_checkout_reservations_currency_check check (currency = 'USD'),
  constraint library_book_checkout_reservations_fee_check check (platform_fee_cents between 0 and amount_cents)
);

create unique index if not exists library_book_checkout_reservations_buyer_publication_uidx
  on public.library_book_checkout_reservations(buyer_id, publication_id);

create unique index if not exists library_book_checkout_reservations_session_uidx
  on public.library_book_checkout_reservations(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists library_book_checkout_reservations_expiry_idx
  on public.library_book_checkout_reservations(checkout_expires_at);

alter table public.library_book_checkout_reservations enable row level security;
revoke all on table public.library_book_checkout_reservations from anon;
revoke all on table public.library_book_checkout_reservations from authenticated;

comment on table public.library_book_checkout_reservations is
  'Server-only Library checkout snapshots. Prevent duplicate live checkout sessions and preserve the price/seller/fee contract that Stripe was created with.';

-- Existing Library section policies remain in place. This restrictive policy adds
-- a commerce boundary on top of them, so a published paid work is not readable
-- merely because an older permissive published-section policy exists.
alter table public.library_publication_sections enable row level security;

drop policy if exists "library commerce requires publication access" on public.library_publication_sections;
create policy "library commerce requires publication access"
  on public.library_publication_sections
  as restrictive
  for select
  to anon, authenticated
  using (
    case
      when auth.uid() is null then exists (
        select 1
          from public.library_publications publication
         where publication.id = library_publication_sections.publication_id
           and publication.status = 'published'
           and publication.is_free is true
      )
      else public.library_current_user_can_access_publication(library_publication_sections.publication_id)
    end
  );

comment on policy "library commerce requires publication access" on public.library_publication_sections is
  'Fail-closed full-text boundary: anonymous readers may select only published free sections; authenticated readers must satisfy the canonical Library publication entitlement predicate.';
