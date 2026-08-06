-- Creator Supporters Phase 2B hardening.
-- Prevents local program shutdown from leaving provider subscriptions billing,
-- places restricted or downgraded creator programs on a billing hold, and queues
-- provider reconciliation before final local revocation.

begin;

create or replace function public.creator_has_live_paid_supporter_subscriptions(
  p_creator_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.creator_supporter_subscriptions subscription
    where subscription.creator_id = p_creator_id
      and subscription.status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid')
  );
$$;

create or replace function public.guard_creator_supporter_program_disable()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if old.enabled = true
    and new.enabled = false
    and public.creator_has_live_paid_supporter_subscriptions(new.creator_id)
  then
    raise exception 'Cancel active paid supporter subscriptions before disabling this program.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_creator_supporter_program_disable_trigger
  on public.creator_supporter_programs;
create trigger guard_creator_supporter_program_disable_trigger
before update of enabled on public.creator_supporter_programs
for each row execute function public.guard_creator_supporter_program_disable();

create or replace function public.hold_or_disable_creator_supporter_program(
  p_creator_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  clean_reason text := left(
    coalesce(nullif(trim(p_reason), ''), 'Creator supporter billing review required.'),
    1000
  );
begin
  if public.creator_has_live_paid_supporter_subscriptions(p_creator_id) then
    update public.creator_supporter_programs
    set accepting_new_supporters = false,
        billing_hold = true,
        billing_hold_reason = clean_reason,
        updated_at = now()
    where creator_id = p_creator_id;

    perform public.queue_creator_supporter_billing_reconciliation(
      p_creator_id,
      clean_reason
    );
  else
    update public.creator_supporter_programs
    set enabled = false,
        accepting_new_supporters = false,
        billing_hold = false,
        billing_hold_reason = null,
        updated_at = now()
    where creator_id = p_creator_id
      and enabled = true;
  end if;
end;
$$;

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
    perform public.hold_or_disable_creator_supporter_program(
      affected_user_id,
      'Creator supporter program entitlement is no longer available.'
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.sync_creator_supporter_profile_access()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.creator_has_supporter_program_access(new.id) then
    perform public.hold_or_disable_creator_supporter_program(
      new.id,
      'Creator account status no longer permits a supporter program.'
    );
  end if;

  return new;
end;
$$;

create or replace function public.finalize_creator_supporter_program_shutdown(
  p_creator_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if public.creator_has_live_paid_supporter_subscriptions(p_creator_id) then
    raise exception 'Provider subscriptions remain active for this creator.'
      using errcode = '23514';
  end if;

  update public.creator_supporter_programs
  set enabled = false,
      accepting_new_supporters = false,
      billing_hold = false,
      billing_hold_reason = null,
      updated_at = now()
  where creator_id = p_creator_id;
end;
$$;

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

  if public.creator_has_live_paid_supporter_subscriptions(new.creator_id) then
    raise exception 'Provider subscriptions must be reconciled before local supporter access is disabled.'
      using errcode = '23514';
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

revoke all on function public.creator_has_live_paid_supporter_subscriptions(uuid)
  from public, anon, authenticated;
revoke all on function public.guard_creator_supporter_program_disable()
  from public, anon, authenticated;
revoke all on function public.hold_or_disable_creator_supporter_program(uuid, text)
  from public, anon, authenticated;
revoke all on function public.sync_creator_supporter_program_entitlement()
  from public, anon, authenticated;
revoke all on function public.sync_creator_supporter_profile_access()
  from public, anon, authenticated;
revoke all on function public.finalize_creator_supporter_program_shutdown(uuid)
  from public, anon, authenticated;
revoke all on function public.revoke_disabled_creator_supporter_program()
  from public, anon, authenticated;

grant execute on function public.finalize_creator_supporter_program_shutdown(uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
