-- Creator Supporters Phase 2A hardening.
-- Revokes supporter-only and automatically provisioned Room access when a program
-- is disabled or the creator loses the required Creator Hub entitlement.

begin;

create or replace function public.revoke_disabled_creator_supporter_program()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.enabled = true then
    return new;
  end if;

  update public.room_members member
  set status = 'removed',
      updated_at = now()
  from public.creator_supporter_room_grants grant_record
  where grant_record.creator_id = new.creator_id
    and grant_record.active = true
    and grant_record.provisioned_membership = true
    and grant_record.room_member_id = member.id
    and member.user_id = grant_record.supporter_id
    and member.role = 'member'
    and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive');

  update public.creator_supporter_room_grants
  set active = false,
      ended_at = now()
  where creator_id = new.creator_id
    and active = true;

  update public.creator_supporter_memberships
  set status = 'removed',
      ended_at = now(),
      updated_at = now()
  where creator_id = new.creator_id
    and status = 'active';

  update public.discussion_audience_preferences
  set default_audience_type = 'public',
      default_audience_base = null,
      include_user_ids = '{}'::uuid[],
      exclude_user_ids = '{}'::uuid[],
      updated_at = now()
  where user_id = new.creator_id
    and default_audience_type = 'supporters';

  return new;
end;
$$;

drop trigger if exists revoke_disabled_creator_supporter_program_trigger
  on public.creator_supporter_programs;
create trigger revoke_disabled_creator_supporter_program_trigger
after insert or update of enabled on public.creator_supporter_programs
for each row
when (new.enabled = false)
execute function public.revoke_disabled_creator_supporter_program();

create or replace function public.validate_active_creator_supporter_membership()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;

  if not exists (
    select 1
    from public.creator_supporter_programs program
    where program.creator_id = new.creator_id
      and program.enabled = true
  ) then
    raise exception 'This supporter program is not active.'
      using errcode = '23514';
  end if;

  if not public.creator_has_supporter_program_access(new.creator_id) then
    raise exception 'This creator supporter program is unavailable.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.creator_supporter_tiers tier
    where tier.id = new.tier_id
      and tier.creator_id = new.creator_id
      and tier.is_active = true
  ) then
    raise exception 'Choose an active supporter tier.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_active_creator_supporter_membership_trigger
  on public.creator_supporter_memberships;
create trigger validate_active_creator_supporter_membership_trigger
before insert or update of creator_id, tier_id, status
on public.creator_supporter_memberships
for each row execute function public.validate_active_creator_supporter_membership();

create or replace function public.sync_creator_supporter_program_entitlement()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  affected_user_id uuid;
begin
  affected_user_id := case
    when tg_op = 'DELETE' then old.user_id
    else new.user_id
  end;

  if affected_user_id is not null
    and not public.creator_has_supporter_program_access(affected_user_id)
  then
    update public.creator_supporter_programs
    set enabled = false,
        updated_at = now()
    where creator_id = affected_user_id
      and enabled = true;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_creator_supporter_entitlement_trigger
  on public.user_ai_entitlements;
create trigger sync_creator_supporter_entitlement_trigger
after insert or update or delete on public.user_ai_entitlements
for each row execute function public.sync_creator_supporter_program_entitlement();

create or replace function public.sync_creator_supporter_profile_access()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.creator_has_supporter_program_access(new.id) then
    update public.creator_supporter_programs
    set enabled = false,
        updated_at = now()
    where creator_id = new.id
      and enabled = true;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_creator_supporter_profile_access_trigger
  on public.profiles;
create trigger sync_creator_supporter_profile_access_trigger
after update of is_admin, account_status on public.profiles
for each row execute function public.sync_creator_supporter_profile_access();

revoke all on function public.revoke_disabled_creator_supporter_program()
  from public, anon, authenticated;
revoke all on function public.validate_active_creator_supporter_membership()
  from public, anon, authenticated;
revoke all on function public.sync_creator_supporter_program_entitlement()
  from public, anon, authenticated;
revoke all on function public.sync_creator_supporter_profile_access()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
