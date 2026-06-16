-- Stickies v1 entitlement correction
-- Allows Premium Plus users to pass the same database RLS access check as Premium users.

create or replace function public.user_has_stickies_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles profile
      where profile.id = target_user_id
        and profile.is_admin = true
    )
    or exists (
      select 1
      from public.user_ai_entitlements entitlement
      where entitlement.user_id = target_user_id
        and entitlement.ai_assisted_enabled = true
        and entitlement.tier in ('premium', 'premium_plus', 'admin')
    );
$$;

comment on function public.user_has_stickies_access(uuid) is
'Stickies access check used by sticky_items RLS. Premium, Premium Plus, and admin users can access Stickies.';
