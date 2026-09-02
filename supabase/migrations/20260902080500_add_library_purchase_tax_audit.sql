-- Library paid-book tax audit fields.
-- Existing historical purchases remain untouched; new checkouts snapshot the
-- explicit tax mode used for the Stripe Checkout Session and any tax withheld.

alter table public.library_book_purchases
  add column if not exists tax_mode text,
  add column if not exists tax_amount_cents integer,
  add column if not exists stripe_tax_transfer_reversal_id text,
  add column if not exists tax_withheld_at timestamptz;

alter table public.library_book_purchases
  drop constraint if exists library_book_purchases_tax_mode_check;
alter table public.library_book_purchases
  add constraint library_book_purchases_tax_mode_check
  check (tax_mode is null or tax_mode in ('platform_stripe_tax', 'external_acknowledged'));

alter table public.library_book_purchases
  drop constraint if exists library_book_purchases_tax_amount_check;
alter table public.library_book_purchases
  add constraint library_book_purchases_tax_amount_check
  check (tax_amount_cents is null or tax_amount_cents >= 0);

create unique index if not exists library_book_purchases_tax_reversal_uidx
  on public.library_book_purchases(stripe_tax_transfer_reversal_id)
  where stripe_tax_transfer_reversal_id is not null;

comment on column public.library_book_purchases.tax_mode is
  'Tax posture snapshotted at checkout: platform_stripe_tax or external_acknowledged. Historical rows may be null.';
comment on column public.library_book_purchases.tax_amount_cents is
  'Indirect tax calculated by Stripe for the completed checkout. Zero for explicit external_acknowledged mode.';
comment on column public.library_book_purchases.stripe_tax_transfer_reversal_id is
  'Stripe transfer reversal used to withhold platform-liable tax from a destination charge.';
comment on column public.library_book_purchases.tax_withheld_at is
  'Timestamp when platform-liable tax withholding was confirmed. Null when no reversal was required.';
