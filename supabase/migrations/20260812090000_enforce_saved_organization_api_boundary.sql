-- Align Saved organization persistence with the current subscription contract.
--
-- This migration is intentionally safe whether it lands immediately before or
-- immediately after the application deployment. Existing authenticated write
-- grants stay intact, while database guards prevent Free clients from bypassing
-- the new save quota. Free folder and private-note direct writes remain protected
-- by their existing paid-only RLS/trigger paths; the application APIs provide the
-- new limited Free mutations through ownership-checked service-role writes.

begin;

-- The private-note API now owns the Free 10-note quota. Permit its service-role
-- mutation path while retaining the pre-existing admin/paid compatibility cases.
create or replace function public.user_has_bookmark_private_notes_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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

-- `bookmarks` historically permits owner inserts directly through PostgREST.
-- Keep that path backward-compatible, but enforce the Free 25-save ceiling in
-- the database as well as in the application API. Existing paid/admin collection
-- access is the stable pre-contract discriminator already used by bookmark RLS.
create or replace function public.enforce_free_bookmark_save_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_count integer;
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;

  if public.user_has_bookmark_collection_access(new.user_id) then
    return new;
  end if;

  select count(*)
  into existing_count
  from public.bookmarks bookmark
  where bookmark.user_id = new.user_id;

  if existing_count >= 25 then
    raise exception 'Free Saved is limited to 25 discussions. Upgrade to Premium for unlimited saves.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_free_bookmark_save_limit_trigger on public.bookmarks;
create trigger enforce_free_bookmark_save_limit_trigger
before insert on public.bookmarks
for each row
execute function public.enforce_free_bookmark_save_limit();

commit;
