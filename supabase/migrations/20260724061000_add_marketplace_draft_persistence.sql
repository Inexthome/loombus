-- Preserve incomplete Marketplace seller drafts without exposing them publicly.

begin;

alter table public.marketplace_listings
  add column if not exists draft_data jsonb not null default '{}'::jsonb;

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_title_length_check;

alter table public.marketplace_listings
  add constraint marketplace_listings_title_length_check
  check (
    status = 'draft'
    or char_length(title) between 3 and 200
  );

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_description_length_check;

alter table public.marketplace_listings
  add constraint marketplace_listings_description_length_check
  check (
    status = 'draft'
    or char_length(description) between 30 and 16000
  );

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_category_length_check;

alter table public.marketplace_listings
  add constraint marketplace_listings_category_length_check
  check (
    status = 'draft'
    or char_length(category) between 1 and 120
  );

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_fulfillment_check;

alter table public.marketplace_listings
  add constraint marketplace_listings_fulfillment_check
  check (
    status = 'draft'
    or pickup_available
    or local_delivery_available
    or shipping_available
  );

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_local_location_check;

alter table public.marketplace_listings
  add constraint marketplace_listings_local_location_check
  check (
    status = 'draft'
    or not (pickup_available or local_delivery_available)
    or nullif(trim(coalesce(city, '')), '') is not null
    or nullif(trim(coalesce(region, '')), '') is not null
  );

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_draft_data_object_check;

alter table public.marketplace_listings
  add constraint marketplace_listings_draft_data_object_check
  check (jsonb_typeof(draft_data) = 'object');

notify pgrst, 'reload schema';

commit;
