-- Platform admins should have the same private-note access the Saved UI grants them.
--
-- The original helper only checked user_ai_entitlements. The Saved page also treats
-- profiles.is_admin as authoritative, so an actual platform admin without an
-- entitlement row could see the note UI but the database trigger rejected the write.

begin;

create or replace function public.user_has_bookmark_private_notes_access(target_user_id uuid)
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
