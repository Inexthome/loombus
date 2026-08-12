-- Align Saved organization persistence with the current subscription contract.
-- This migration is safe before or after the application deployment.

begin;

create or replace function public.request_has_unlimited_organization()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb
      ->> 'x-loombus-unlimited-organization',
    'false'
  ) = 'true';
$$;

revoke all on function public.request_has_unlimited_organization() from public;
revoke all on function public.request_has_unlimited_organization() from authenticated;
grant execute on function public.request_has_unlimited_organization() to service_role;

-- The note API owns plan resolution and sends the entitlement only on the
-- service-role request. Keep legacy paid/admin compatibility for direct paths.
create or replace function public.user_has_bookmark_private_notes_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.role()) = 'service_role'
    or exists (
      select 1
      from public.profiles profile
      where profile.id = target_user_id
        and profile.is_admin is true
    )
    or exists (
      select 1
      from public.user_ai_entitlements entitlement
      where entitlement.user_id = target_user_id
        and (
          entitlement.tier = 'admin'
          or (
            entitlement.ai_assisted_enabled = true
            and entitlement.tier = 'premium'
            and entitlement.monthly_summary_limit > 50
          )
        )
    );
$$;

create or replace function public.enforce_saved_discussion_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_name text := (select auth.role());
  existing_count integer;
begin
  if role_name is null then return new; end if;
  if role_name = 'service_role' then
    if public.request_has_unlimited_organization() then return new; end if;
  elsif public.user_has_bookmark_collection_access(new.user_id) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('loombus_saved'), hashtext(new.user_id::text));
  select count(*) into existing_count from public.bookmarks b where b.user_id = new.user_id;
  if existing_count >= 25 then
    raise exception 'Free Saved is limited to 25 discussions. Upgrade to Premium for unlimited saves.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_saved_discussion_limit_trigger on public.bookmarks;
create trigger enforce_saved_discussion_limit_trigger
before insert on public.bookmarks
for each row execute function public.enforce_saved_discussion_limit();

create or replace function public.enforce_saved_folder_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_name text := (select auth.role());
  existing_count integer;
begin
  if role_name is null then return new; end if;
  if role_name = 'service_role' then
    if public.request_has_unlimited_organization() then return new; end if;
  elsif public.user_has_bookmark_collection_access(new.user_id) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('loombus_saved_folder'), hashtext(new.user_id::text));
  select count(*) into existing_count from public.bookmark_collections c where c.user_id = new.user_id;
  if existing_count >= 3 then
    raise exception 'Free Saved folders are limited to 3. Upgrade to Premium for unlimited folders.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_saved_folder_limit_trigger on public.bookmark_collections;
create trigger enforce_saved_folder_limit_trigger
before insert on public.bookmark_collections
for each row execute function public.enforce_saved_folder_limit();

create or replace function public.enforce_saved_private_note_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_name text := (select auth.role());
  existing_count integer;
begin
  if new.private_note is not distinct from old.private_note then return new; end if;
  if nullif(btrim(old.private_note), '') is not null then return new; end if;
  if nullif(btrim(new.private_note), '') is null then return new; end if;
  if role_name is null then return new; end if;

  if role_name = 'service_role' then
    if public.request_has_unlimited_organization() then return new; end if;
  elsif public.user_has_bookmark_private_notes_access(new.user_id) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('loombus_saved_note'), hashtext(new.user_id::text));
  select count(*) into existing_count
  from public.bookmarks b
  where b.user_id = new.user_id
    and nullif(btrim(b.private_note), '') is not null;

  if existing_count >= 10 then
    raise exception 'Free private notes are limited to 10 saved discussions. Upgrade to Premium for unlimited private notes.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_saved_private_note_limit_trigger on public.bookmarks;
create trigger enforce_saved_private_note_limit_trigger
before update of private_note on public.bookmarks
for each row execute function public.enforce_saved_private_note_limit();

commit;
