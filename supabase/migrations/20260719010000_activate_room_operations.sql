-- Room operations: member controls, moderation, billing usage, ownership, and lifecycle.

begin;

alter table public.rooms
  add column if not exists original_owner_id uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz,
  add column if not exists deletion_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists ownership_transferred_at timestamptz;

update public.rooms
set original_owner_id = coalesce(original_owner_id, owner_id, created_by)
where original_owner_id is null;

alter table public.room_members
  add column if not exists muted_until timestamptz,
  add column if not exists suspended_until timestamptz,
  add column if not exists moderation_note text,
  add column if not exists moderated_by uuid references auth.users(id) on delete set null,
  add column if not exists moderated_at timestamptz;

create index if not exists room_members_room_suspended_idx
  on public.room_members (room_id, suspended_until)
  where suspended_until is not null;

create index if not exists room_members_room_muted_idx
  on public.room_members (room_id, muted_until)
  where muted_until is not null;

create table if not exists public.room_moderation_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  target_label text not null,
  target_snapshot text not null default '',
  reason text not null,
  details text not null default '',
  state text not null default 'pending',
  resolution_note text not null default '',
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_moderation_reports_target_type_check check (
    target_type in (
      'room_post',
      'room_member',
      'room_module_record',
      'room_resource',
      'room_announcement',
      'room_event'
    )
  ),
  constraint room_moderation_reports_reason_check check (
    reason in (
      'spam',
      'harassment',
      'safety',
      'privacy',
      'misinformation',
      'inappropriate',
      'other'
    )
  ),
  constraint room_moderation_reports_state_check check (
    state in ('pending', 'resolved', 'dismissed', 'actioned')
  ),
  constraint room_moderation_reports_label_length_check check (
    char_length(target_label) between 1 and 240
  ),
  constraint room_moderation_reports_snapshot_length_check check (
    char_length(target_snapshot) <= 2000
  ),
  constraint room_moderation_reports_details_length_check check (
    char_length(details) <= 2000
  ),
  constraint room_moderation_reports_resolution_length_check check (
    char_length(resolution_note) <= 2000
  )
);

create index if not exists room_moderation_reports_room_state_created_idx
  on public.room_moderation_reports (room_id, state, created_at desc);

create index if not exists room_moderation_reports_reporter_created_idx
  on public.room_moderation_reports (reporter_id, created_at desc);

create unique index if not exists room_moderation_reports_pending_unique_idx
  on public.room_moderation_reports (
    room_id,
    reporter_id,
    target_type,
    target_id
  )
  where state = 'pending';

create or replace function public.touch_room_operations_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_room_moderation_reports_updated_at
  on public.room_moderation_reports;

create trigger touch_room_moderation_reports_updated_at
before update on public.room_moderation_reports
for each row execute function public.touch_room_operations_updated_at();

alter table public.room_moderation_reports enable row level security;

revoke all on table public.room_moderation_reports from anon;
revoke all on table public.room_moderation_reports from authenticated;

create or replace function public.user_is_active_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = auth.uid()
      and coalesce(member.status, 'active')
        not in ('blocked', 'removed', 'inactive')
      and (
        member.suspended_until is null
        or member.suspended_until <= now()
      )
  )
  or exists (
    select 1
    from public.rooms room
    where room.id = target_room_id
      and (
        room.owner_id = auth.uid()
        or room.created_by = auth.uid()
      )
  );
$$;

create or replace function public.user_can_manage_live_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms room
    where room.id = target_room_id
      and (
        room.owner_id = auth.uid()
        or room.created_by = auth.uid()
      )
  )
  or exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = auth.uid()
      and coalesce(member.status, 'active')
        not in ('blocked', 'removed', 'inactive')
      and (
        member.suspended_until is null
        or member.suspended_until <= now()
      )
      and member.role in ('owner', 'admin', 'administrator')
  );
$$;

create or replace function public.user_can_moderate_live_room(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_can_manage_live_room(target_room_id)
  or exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = auth.uid()
      and coalesce(member.status, 'active')
        not in ('blocked', 'removed', 'inactive')
      and (
        member.suspended_until is null
        or member.suspended_until <= now()
      )
      and member.role = 'moderator'
  );
$$;

create or replace function public.enforce_room_member_post_setting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_posts_allowed boolean;
  membership public.room_members%rowtype;
begin
  if exists (
    select 1
    from public.rooms room
    where room.id = new.room_id
      and (
        room.owner_id = new.author_id
        or room.created_by = new.author_id
      )
  ) then
    return new;
  end if;

  select *
  into membership
  from public.room_members member
  where member.room_id = new.room_id
    and member.user_id = new.author_id;

  if not found
    or coalesce(membership.status, 'active')
      in ('blocked', 'removed', 'inactive')
    or (
      membership.suspended_until is not null
      and membership.suspended_until > now()
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Room membership is not active.';
  end if;

  if membership.muted_until is not null
    and membership.muted_until > now()
  then
    raise exception using
      errcode = '42501',
      message = 'This Room membership is temporarily muted.';
  end if;

  select coalesce(
    (settings.settings ->> 'allowMemberPosts')::boolean,
    true
  )
  into member_posts_allowed
  from public.room_module_settings settings
  where settings.room_id = new.room_id;

  if coalesce(member_posts_allowed, true) then
    return new;
  end if;

  if membership.role in (
    'owner',
    'admin',
    'administrator',
    'moderator'
  ) then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message =
      'Room member discussions are disabled by Room administrators.';
end;
$$;

create or replace function public.enforce_active_room_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.rooms room
    where room.id = new.room_id
      and coalesce(room.status, 'active') = 'active'
  ) then
    raise exception using
      errcode = '42501',
      message = 'This Room is read-only while archived or pending deletion.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_active_room_post_insert
  on public.room_posts;
create trigger enforce_active_room_post_insert
before insert or update on public.room_posts
for each row execute function public.enforce_active_room_insert();

drop trigger if exists enforce_active_room_event_insert
  on public.room_events;
create trigger enforce_active_room_event_insert
before insert or update on public.room_events
for each row execute function public.enforce_active_room_insert();

drop trigger if exists enforce_active_room_announcement_insert
  on public.room_announcements;
create trigger enforce_active_room_announcement_insert
before insert or update on public.room_announcements
for each row execute function public.enforce_active_room_insert();

drop trigger if exists enforce_active_room_module_record_insert
  on public.room_module_records;
create trigger enforce_active_room_module_record_insert
before insert or update on public.room_module_records
for each row execute function public.enforce_active_room_insert();

drop trigger if exists enforce_active_room_module_response_insert
  on public.room_module_responses;
create trigger enforce_active_room_module_response_insert
before insert or update on public.room_module_responses
for each row execute function public.enforce_active_room_insert();

drop trigger if exists enforce_active_room_resource_insert
  on public.room_resources;
create trigger enforce_active_room_resource_insert
before insert or update on public.room_resources
for each row execute function public.enforce_active_room_insert();

drop trigger if exists enforce_active_room_application_insert
  on public.room_applications;
create trigger enforce_active_room_application_insert
before insert or update on public.room_applications
for each row execute function public.enforce_active_room_insert();

drop trigger if exists enforce_active_room_invite_insert
  on public.room_invites;
create trigger enforce_active_room_invite_insert
before insert or update on public.room_invites
for each row execute function public.enforce_active_room_insert();

create or replace function public.capture_room_member_control_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.muted_until is not distinct from old.muted_until
    and new.suspended_until is not distinct from old.suspended_until
    and new.moderation_note is not distinct from old.moderation_note
  then
    return new;
  end if;

  perform public.insert_room_activity_event(
    new.room_id,
    new.moderated_by,
    'member_controls_updated',
    'members',
    'room_member',
    new.id,
    'Room member controls updated',
    case
      when new.suspended_until is not null and new.suspended_until > now()
        then 'A Room membership was suspended.'
      when new.muted_until is not null and new.muted_until > now()
        then 'A Room membership was muted.'
      else 'Room member controls were restored or updated.'
    end,
    'managers',
    'normal',
    jsonb_build_object(
      'memberId', new.user_id,
      'mutedUntil', new.muted_until,
      'suspendedUntil', new.suspended_until
    )
  );

  return new;
end;
$$;

drop trigger if exists capture_room_member_control_activity_trigger
  on public.room_members;
create trigger capture_room_member_control_activity_trigger
after update on public.room_members
for each row execute function public.capture_room_member_control_activity();

create or replace function public.capture_room_lifecycle_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lifecycle_title text;
  lifecycle_summary text;
begin
  if new.owner_id is distinct from old.owner_id then
    lifecycle_title := 'Room ownership transferred';
    lifecycle_summary := 'A new owner now governs this private Room.';
  elsif new.status is distinct from old.status then
    lifecycle_title := case new.status
      when 'archived' then 'Room archived'
      when 'pending_deletion' then 'Room deletion scheduled'
      when 'active' then 'Room restored'
      else 'Room lifecycle updated'
    end;
    lifecycle_summary := case new.status
      when 'archived' then 'The Room is read-only until an owner restores it.'
      when 'pending_deletion' then 'The Room entered its 30-day deletion recovery period.'
      when 'active' then 'The Room returned to active operation.'
      else 'The Room operating status changed.'
    end;
  else
    return new;
  end if;

  perform public.insert_room_activity_event(
    new.id,
    coalesce(new.deletion_requested_by, new.archived_by, new.owner_id),
    case
      when new.owner_id is distinct from old.owner_id then 'ownership_transferred'
      else 'room_status_changed'
    end,
    'overview',
    'room',
    new.id,
    lifecycle_title,
    lifecycle_summary,
    'all',
    'high',
    jsonb_build_object(
      'status', new.status,
      'deletionScheduledFor', new.deletion_scheduled_for
    )
  );

  return new;
end;
$$;

drop trigger if exists capture_room_lifecycle_activity_trigger
  on public.rooms;
create trigger capture_room_lifecycle_activity_trigger
after update on public.rooms
for each row execute function public.capture_room_lifecycle_activity();

create or replace function public.transfer_room_ownership(
  target_room_id uuid,
  acting_owner_id uuid,
  next_owner_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  room_row public.rooms%rowtype;
begin
  select *
  into room_row
  from public.rooms room
  where room.id = target_room_id
  for update;

  if not found then
    raise exception 'Room not found.';
  end if;

  if acting_owner_id = next_owner_id then
    raise exception 'Choose a different Room owner.';
  end if;

  if coalesce(room_row.subscription_plan, 'free') <> 'free'
    and lower(coalesce(room_row.subscription_status, 'active')) in ('active', 'trialing')
  then
    raise exception
      'Cancel active Room billing before transferring ownership.';
  end if;

  if room_row.owner_id is distinct from acting_owner_id
    and room_row.created_by is distinct from acting_owner_id
  then
    raise exception 'Only the current Room owner can transfer ownership.';
  end if;

  if not exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = next_owner_id
      and coalesce(member.status, 'active')
        not in ('blocked', 'removed', 'inactive')
      and (
        member.suspended_until is null
        or member.suspended_until <= now()
      )
  ) then
    raise exception 'The next owner must be an active Room member.';
  end if;

  insert into public.room_members (
    room_id,
    user_id,
    role,
    status,
    joined_at,
    created_at,
    updated_at
  )
  values (
    target_room_id,
    acting_owner_id,
    'admin',
    'active',
    now(),
    now(),
    now()
  )
  on conflict (room_id, user_id)
  do update set
    role = 'admin',
    status = 'active',
    suspended_until = null,
    muted_until = null,
    updated_at = now();

  insert into public.room_members (
    room_id,
    user_id,
    role,
    status,
    joined_at,
    created_at,
    updated_at
  )
  values (
    target_room_id,
    next_owner_id,
    'owner',
    'active',
    now(),
    now(),
    now()
  )
  on conflict (room_id, user_id)
  do update set
    role = 'owner',
    status = 'active',
    suspended_until = null,
    muted_until = null,
    updated_at = now();

  update public.rooms
  set
    original_owner_id = coalesce(
      original_owner_id,
      owner_id,
      created_by,
      acting_owner_id
    ),
    owner_id = next_owner_id,
    created_by = next_owner_id,
    stripe_customer_id = null,
    stripe_subscription_id = null,
    stripe_price_id = null,
    stripe_checkout_session_id = null,
    stripe_current_period_end = null,
    billing_updated_at = now(),
    ownership_transferred_at = now(),
    updated_at = now()
  where id = target_room_id;

  return true;
end;
$$;

revoke all on function public.transfer_room_ownership(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.transfer_room_ownership(uuid, uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
