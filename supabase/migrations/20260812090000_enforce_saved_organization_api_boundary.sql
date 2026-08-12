-- Saved organization quotas are enforced by authenticated application API routes.
-- Keep owner reads available through RLS, but prevent authenticated clients from
-- bypassing the 25-save / 3-folder / 10-private-note limits through direct PostgREST writes.
-- Service-role mutations still pass database constraints/triggers and are always
-- filtered by the authenticated user id in the application routes.

begin;

revoke insert, update, delete on table public.bookmarks from authenticated;
revoke insert, update, delete on table public.bookmark_collections from authenticated;

-- Private-note writes are now authorized and quota-checked by the bookmark note API.
-- The existing database guard must therefore permit the service-role mutation path.
-- Retain the legacy admin/paid cases for compatibility with any internal database
-- workflow that still invokes this helper directly.
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

commit;
