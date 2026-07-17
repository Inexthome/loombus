-- Marketplace saved items, attributable seller contacts, and lifecycle notifications.

begin;

create table if not exists public.marketplace_saved_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint marketplace_saved_listings_unique unique (user_id, listing_id)
);

create table if not exists public.marketplace_contact_threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint marketplace_contact_threads_parties_check check (buyer_id <> seller_id),
  constraint marketplace_contact_threads_unique unique (listing_id, buyer_id)
);

create index if not exists marketplace_saved_listings_user_idx
  on public.marketplace_saved_listings (user_id, created_at desc);

create index if not exists marketplace_saved_listings_listing_idx
  on public.marketplace_saved_listings (listing_id, created_at desc);

create index if not exists marketplace_contact_threads_seller_idx
  on public.marketplace_contact_threads (seller_id, created_at desc);

create index if not exists marketplace_contact_threads_buyer_idx
  on public.marketplace_contact_threads (buyer_id, created_at desc);

alter table public.marketplace_saved_listings enable row level security;
alter table public.marketplace_contact_threads enable row level security;

revoke all on table public.marketplace_saved_listings
  from public, anon, authenticated;
revoke all on table public.marketplace_contact_threads
  from public, anon, authenticated;

grant all on table public.marketplace_saved_listings to service_role;
grant all on table public.marketplace_contact_threads to service_role;

create or replace function public.notify_marketplace_listing_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_message text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      target_type,
      target_id,
      message
    )
    select
      profile.id,
      new.seller_id,
      'marketplace_review_requested',
      'profile',
      new.seller_id,
      'A Marketplace listing is ready for review: ' || new.title
    from public.profiles profile
    where profile.is_admin = true
      and profile.id <> new.seller_id;

    return new;
  end if;

  if tg_op <> 'UPDATE' or old.status is not distinct from new.status then
    return new;
  end if;

  if new.status = 'published' then
    notification_message := 'Your Marketplace listing is now public: ' || new.title;
  elsif new.status = 'rejected' then
    notification_message := 'Your Marketplace listing needs changes: ' || new.title;
  elsif new.status = 'suspended' then
    notification_message := 'Your Marketplace listing was suspended: ' || new.title;
  elsif new.status = 'removed' then
    notification_message := 'Your Marketplace listing was removed: ' || new.title;
  elsif new.status = 'expired' then
    notification_message := 'Your Marketplace listing expired: ' || new.title;
  else
    notification_message := null;
  end if;

  if notification_message is not null then
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      target_type,
      target_id,
      message
    )
    values (
      new.seller_id,
      new.seller_id,
      'marketplace_listing_status',
      'profile',
      new.seller_id,
      notification_message
    );
  end if;

  if new.status = 'pending' then
    insert into public.notifications (
      user_id,
      actor_id,
      type,
      target_type,
      target_id,
      message
    )
    select
      profile.id,
      new.seller_id,
      'marketplace_review_requested',
      'profile',
      new.seller_id,
      'A Marketplace listing returned to review: ' || new.title
    from public.profiles profile
    where profile.is_admin = true
      and profile.id <> new.seller_id;
  end if;

  if new.status in ('sold', 'removed', 'expired', 'suspended') then
    notification_message := case new.status
      when 'sold' then 'A saved Marketplace item was marked sold: '
      when 'removed' then 'A saved Marketplace item was removed: '
      when 'expired' then 'A saved Marketplace item expired: '
      else 'A saved Marketplace item is no longer public: '
    end || new.title;

    insert into public.notifications (
      user_id,
      actor_id,
      type,
      target_type,
      target_id,
      message
    )
    select
      saved.user_id,
      new.seller_id,
      'marketplace_saved_status',
      'profile',
      new.seller_id,
      notification_message
    from public.marketplace_saved_listings saved
    where saved.listing_id = new.id
      and saved.user_id <> new.seller_id;
  end if;

  return new;
end;
$$;

create or replace function public.notify_marketplace_report_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_title text;
begin
  select title
  into listing_title
  from public.marketplace_listings
  where id = new.listing_id;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    target_type,
    target_id,
    message
  )
  select
    profile.id,
    new.reporter_id,
    'marketplace_report_received',
    'profile',
    new.reporter_id,
    'A Marketplace listing was reported: ' || coalesce(listing_title, 'Marketplace listing')
  from public.profiles profile
  where profile.is_admin = true
    and profile.id <> new.reporter_id;

  return new;
end;
$$;

drop trigger if exists notify_marketplace_listing_created
  on public.marketplace_listings;
create trigger notify_marketplace_listing_created
after insert on public.marketplace_listings
for each row execute function public.notify_marketplace_listing_lifecycle();

drop trigger if exists notify_marketplace_listing_status_changed
  on public.marketplace_listings;
create trigger notify_marketplace_listing_status_changed
after update of status on public.marketplace_listings
for each row execute function public.notify_marketplace_listing_lifecycle();

drop trigger if exists notify_marketplace_report_created
  on public.marketplace_reports;
create trigger notify_marketplace_report_created
after insert on public.marketplace_reports
for each row execute function public.notify_marketplace_report_created();

revoke all on function public.notify_marketplace_listing_lifecycle()
  from public, anon, authenticated;
revoke all on function public.notify_marketplace_report_created()
  from public, anon, authenticated;

grant execute on function public.notify_marketplace_listing_lifecycle()
  to service_role;
grant execute on function public.notify_marketplace_report_created()
  to service_role;

insert into public.loombus_search_documents (
  source_table,
  entity_type,
  entity_id,
  title,
  summary,
  body,
  keywords,
  href,
  visibility,
  status,
  signal_score,
  metadata,
  source_created_at,
  source_updated_at
)
values (
  'platform_pages',
  'page',
  '6412897b-977d-4799-8da8-9a2bb63b5b27'::uuid,
  'Marketplace Safety and Policy',
  'Review Loombus Marketplace rules, transaction boundaries, reporting, and safer exchange practices.',
  'Marketplace safety explains prohibited listings, profile-based seller contact, payment and escrow boundaries, reporting, local pickup precautions, and protection of personal information.',
  array[
    'marketplace safety',
    'marketplace policy',
    'prohibited items',
    'buyer safety',
    'seller safety',
    'transaction safety',
    'report listing',
    'no escrow'
  ],
  '/marketplace/safety',
  'public',
  'active',
  0,
  jsonb_build_object('category', 'Safety'),
  now(),
  now()
)
on conflict (source_table, entity_id)
do update set
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  keywords = excluded.keywords,
  href = excluded.href,
  visibility = excluded.visibility,
  status = excluded.status,
  metadata = excluded.metadata,
  source_updated_at = now(),
  updated_at = now();

commit;
