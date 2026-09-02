-- Loombus Library commerce foundation.
--
-- Adds author-controlled free/paid offer metadata, immutable purchase records,
-- and one canonical fail-closed access predicate for future paid-content routes.
-- Checkout and Stripe fulfillment are intentionally separate follow-on work.

alter table public.library_publications
  add column if not exists price_cents integer,
  add column if not exists currency text;

update public.library_publications
   set price_cents = null,
       currency = null
 where is_free is true;

alter table public.library_publications
  drop constraint if exists library_publications_commerce_offer_check;

alter table public.library_publications
  add constraint library_publications_commerce_offer_check check (
    (is_free is true and price_cents is null and currency is null)
    or
    (is_free is false
      and price_cents between 100 and 100000
      and currency = 'USD')
  );

comment on column public.library_publications.price_cents is
  'Current Library selling price in integer minor currency units. Null for free publications. Purchase records snapshot the price actually paid.';
comment on column public.library_publications.currency is
  'Current Library selling currency. Initial commerce scope supports USD only; null for free publications.';

create table if not exists public.library_book_purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  publication_id uuid not null references public.library_publications(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending',
  amount_cents integer not null,
  currency text not null,
  platform_fee_cents integer not null default 0,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  purchased_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_book_purchases_status_check check (
    status in ('pending', 'paid', 'refunded', 'disputed', 'chargeback')
  ),
  constraint library_book_purchases_amount_check check (amount_cents between 100 and 100000),
  constraint library_book_purchases_platform_fee_check check (
    platform_fee_cents between 0 and amount_cents
  ),
  constraint library_book_purchases_currency_check check (currency = 'USD'),
  constraint library_book_purchases_paid_time_check check (
    status <> 'paid' or purchased_at is not null
  ),
  constraint library_book_purchases_refund_time_check check (
    status <> 'refunded' or refunded_at is not null
  ),
  constraint library_book_purchases_dispute_time_check check (
    status not in ('disputed', 'chargeback') or disputed_at is not null
  )
);

create unique index if not exists library_book_purchases_checkout_session_uidx
  on public.library_book_purchases(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists library_book_purchases_payment_intent_uidx
  on public.library_book_purchases(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists library_book_purchases_active_entitlement_uidx
  on public.library_book_purchases(buyer_id, publication_id)
  where status in ('paid', 'disputed');

create index if not exists library_book_purchases_buyer_created_idx
  on public.library_book_purchases(buyer_id, created_at desc);

create index if not exists library_book_purchases_seller_created_idx
  on public.library_book_purchases(seller_id, created_at desc);

alter table public.library_book_purchases enable row level security;

revoke all on table public.library_book_purchases from anon;
revoke all on table public.library_book_purchases from authenticated;
grant select on table public.library_book_purchases to authenticated;

drop policy if exists "buyers read own library purchases" on public.library_book_purchases;
create policy "buyers read own library purchases"
  on public.library_book_purchases
  for select
  to authenticated
  using (buyer_id = auth.uid());

drop policy if exists "authors read sales for own library publications" on public.library_book_purchases;
create policy "authors read sales for own library publications"
  on public.library_book_purchases
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.library_author_publications author_publication
       where author_publication.publication_id = library_book_purchases.publication_id
         and author_publication.user_id = auth.uid()
    )
  );

create or replace function public.library_current_user_can_access_publication(
  p_publication_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.library_publications publication
     where publication.id = p_publication_id
       and (
         exists (
           select 1
             from public.library_author_publications author_publication
            where author_publication.publication_id = publication.id
              and author_publication.user_id = auth.uid()
              and author_publication.retired_at is null
         )
         or (
           publication.status = 'published'
           and (
             publication.is_free is true
             or exists (
               select 1
                 from public.library_book_purchases purchase
                where purchase.publication_id = publication.id
                  and purchase.buyer_id = auth.uid()
                  and purchase.status in ('paid', 'disputed')
             )
           )
         )
       )
  );
$$;

revoke all on function public.library_current_user_can_access_publication(uuid) from public;
grant execute on function public.library_current_user_can_access_publication(uuid) to authenticated;

create or replace function public.update_library_author_draft_commerce(
  p_publication_id uuid,
  p_is_free boolean,
  p_price_cents integer default null,
  p_currency text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission_status text;
  v_price_cents integer;
  v_currency text;
begin
  if v_user_id is null then
    raise exception 'library_author_auth_required';
  end if;

  if p_is_free is null then
    raise exception 'library_commerce_access_mode_required';
  end if;

  if p_is_free then
    v_price_cents := null;
    v_currency := null;
  else
    if p_price_cents is null or p_price_cents < 100 or p_price_cents > 100000 then
      raise exception 'library_commerce_price_invalid';
    end if;
    if upper(btrim(coalesce(p_currency, ''))) <> 'USD' then
      raise exception 'library_commerce_currency_invalid';
    end if;
    v_price_cents := p_price_cents;
    v_currency := 'USD';
  end if;

  select author_publication.submission_status
    into v_submission_status
    from public.library_author_publications author_publication
    join public.library_publications publication
      on publication.id = author_publication.publication_id
   where author_publication.publication_id = p_publication_id
     and author_publication.user_id = v_user_id
     and author_publication.retired_at is null
     and publication.status = 'draft'
   for update of author_publication, publication;

  if v_submission_status is null then
    raise exception 'library_author_publication_not_owned_or_not_draft';
  end if;

  if v_submission_status not in ('draft', 'changes_requested') then
    raise exception 'library_author_publication_not_editable';
  end if;

  update public.library_publications
     set is_free = p_is_free,
         price_cents = v_price_cents,
         currency = v_currency,
         updated_at = now()
   where id = p_publication_id
     and status = 'draft';

  if not found then
    raise exception 'library_author_canonical_publication_not_editable';
  end if;

  update public.library_author_publications
     set updated_at = now()
   where publication_id = p_publication_id
     and user_id = v_user_id;
end;
$$;

revoke all on function public.update_library_author_draft_commerce(uuid, boolean, integer, text) from public;
grant execute on function public.update_library_author_draft_commerce(uuid, boolean, integer, text) to authenticated;

comment on table public.library_book_purchases is
  'Immutable Library book commerce ledger. Server-side checkout fulfillment may insert/update transaction state; browsers receive SELECT-only access through RLS.';
comment on function public.library_current_user_can_access_publication(uuid) is
  'Canonical Library publication access predicate. Owners may access active author work; other members require a published free publication or an active paid entitlement.';
comment on function public.update_library_author_draft_commerce(uuid, boolean, integer, text) is
  'Owner-only draft/changes-requested commerce editor. Free publications clear price/currency; paid publications require an integer USD price between $1 and $1,000.';
