-- Add a seller-controlled Reserved lifecycle state without weakening Marketplace moderation.

begin;

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_status_check;

alter table public.marketplace_listings
  add constraint marketplace_listings_status_check
  check (
    status in (
      'draft',
      'pending',
      'published',
      'reserved',
      'rejected',
      'suspended',
      'sold',
      'expired',
      'removed'
    )
  );

drop index if exists public.marketplace_listings_expiration_idx;
create index marketplace_listings_expiration_idx
  on public.marketplace_listings (status, expires_at)
  where status in ('published', 'reserved');

create or replace function public.expire_marketplace_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer := 0;
begin
  update public.marketplace_listings
  set
    status = 'expired',
    moderation_reason = coalesce(
      moderation_reason,
      'Automatically expired after the seller-selected availability date.'
    )
  where status in ('published', 'reserved')
    and expires_at is not null
    and expires_at <= now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

-- Preserve the existing public Marketplace query and all of its seller/business
-- eligibility gates. Only widen the existing public-status predicate.
do $$
declare
  function_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.search_public_marketplace(text,text,text,text,text,numeric,numeric,integer,integer)'::regprocedure
  ) into function_definition;

  updated_definition := replace(
    function_definition,
    'where listing.status = ''published''',
    'where listing.status in (''published'', ''reserved'')'
  );

  if updated_definition = function_definition then
    raise exception 'Could not locate the Marketplace public status predicate.';
  end if;

  execute updated_definition;
end;
$$;

-- Keep Reserved listings in Everything Search by widening only the existing
-- indexing status gate. The rest of the seller/business eligibility logic is
-- retained verbatim from the installed function.
do $$
declare
  function_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.index_marketplace_listing_search(uuid)'::regprocedure
  ) into function_definition;

  updated_definition := replace(
    function_definition,
    'or listing_row.status <> ''published''',
    'or listing_row.status not in (''published'', ''reserved'')'
  );

  if updated_definition = function_definition then
    raise exception 'Could not locate the Marketplace search indexing status predicate.';
  end if;

  execute updated_definition;
end;
$$;

-- Guard lifecycle transitions at the database boundary so stale clients and
-- alternate server paths cannot bypass the seller-state rules.
create or replace function public.enforce_marketplace_listing_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'reserved' and old.status <> 'published' then
    raise exception 'Marketplace listings can only be reserved from published status.'
      using errcode = '23514';
  end if;

  if new.status = 'sold' and old.status not in ('published', 'reserved') then
    raise exception 'Marketplace listings can only be sold from published or reserved status.'
      using errcode = '23514';
  end if;

  if old.status = 'reserved'
    and new.status not in (
      'published',
      'draft',
      'pending',
      'sold',
      'suspended',
      'expired',
      'removed'
    )
  then
    raise exception 'Invalid Marketplace reserved status transition.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists marketplace_listing_status_transition_guard
  on public.marketplace_listings;
create trigger marketplace_listing_status_transition_guard
before update of status on public.marketplace_listings
for each row execute function public.enforce_marketplace_listing_status_transition();

revoke all on function public.enforce_marketplace_listing_status_transition()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
