-- Expand private Room calendar lifecycle, recurring occurrences, and atomic RSVP capacity.

begin;

alter table public.room_events
  add column if not exists status text not null default 'scheduled',
  add column if not exists all_day boolean not null default false,
  add column if not exists online_url text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_at timestamptz;

update public.room_events
set status = 'scheduled'
where status is null or status not in ('scheduled', 'cancelled');

alter table public.room_events
  drop constraint if exists room_events_status_check;
alter table public.room_events
  add constraint room_events_status_check
  check (status in ('scheduled', 'cancelled'));

alter table public.room_events
  drop constraint if exists room_events_time_order_check;
alter table public.room_events
  add constraint room_events_time_order_check
  check (ends_at is null or ends_at > starts_at);

alter table public.room_events
  drop constraint if exists room_events_recurrence_until_check;
alter table public.room_events
  add constraint room_events_recurrence_until_check
  check (recurrence_until is null or recurrence_until >= starts_at);

alter table public.room_events
  drop constraint if exists room_events_capacity_check;
alter table public.room_events
  add constraint room_events_capacity_check
  check (capacity is null or capacity between 1 and 100000);

alter table public.room_events
  drop constraint if exists room_events_online_url_check;
alter table public.room_events
  add constraint room_events_online_url_check
  check (online_url is null or online_url ~* '^https://');

alter table public.room_events
  drop constraint if exists room_events_timezone_length_check;
alter table public.room_events
  add constraint room_events_timezone_length_check
  check (char_length(btrim(timezone)) between 1 and 100);

create index if not exists room_events_room_status_start_idx
  on public.room_events (room_id, status, starts_at asc);
create index if not exists room_events_room_recurrence_idx
  on public.room_events (room_id, recurrence_until asc)
  where recurrence_rule is not null and status = 'scheduled';

alter table public.room_event_rsvps
  add column if not exists occurrence_start timestamptz;

update public.room_event_rsvps response
set occurrence_start = event.starts_at
from public.room_events event
where response.event_id = event.id
  and response.occurrence_start is null;

alter table public.room_event_rsvps
  alter column occurrence_start set not null;

alter table public.room_event_rsvps
  drop constraint if exists room_event_rsvps_pkey;
alter table public.room_event_rsvps
  add constraint room_event_rsvps_pkey
  primary key (event_id, occurrence_start, user_id);

create index if not exists room_event_rsvps_occurrence_status_idx
  on public.room_event_rsvps (event_id, occurrence_start, status, updated_at asc);
create index if not exists room_event_rsvps_user_occurrence_idx
  on public.room_event_rsvps (user_id, occurrence_start desc);

create or replace function public.set_room_event_rsvp(
  target_event_id uuid,
  target_user_id uuid,
  target_occurrence_start timestamptz,
  target_status text,
  target_note text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.room_events%rowtype;
  previous_status text;
  resolved_status text;
  going_count integer;
  promoted_user_id uuid;
begin
  if target_status not in ('going', 'maybe', 'declined', 'none') then
    raise exception 'ROOM_EVENT_INVALID_RSVP_STATUS';
  end if;

  select *
  into event_row
  from public.room_events event
  where event.id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'ROOM_EVENT_NOT_FOUND';
  end if;

  if event_row.status <> 'scheduled' then
    raise exception 'ROOM_EVENT_RSVP_CLOSED';
  end if;

  if target_occurrence_start < event_row.starts_at
    or (
      event_row.recurrence_rule is null
      and abs(extract(epoch from (target_occurrence_start - event_row.starts_at))) > 1
    )
    or (
      event_row.recurrence_until is not null
      and target_occurrence_start > event_row.recurrence_until
    )
  then
    raise exception 'ROOM_EVENT_INVALID_OCCURRENCE';
  end if;

  if target_occurrence_start <= now() - interval '5 minutes' then
    raise exception 'ROOM_EVENT_RSVP_CLOSED';
  end if;

  if not exists (
    select 1
    from public.rooms room
    where room.id = event_row.room_id
      and (room.owner_id = target_user_id or room.created_by = target_user_id)
  ) and not exists (
    select 1
    from public.room_members member
    where member.room_id = event_row.room_id
      and member.user_id = target_user_id
      and lower(coalesce(member.status, 'active')) not in (
        'blocked', 'removed', 'inactive', 'suspended'
      )
      and (member.suspended_until is null or member.suspended_until <= now())
  ) then
    raise exception 'ROOM_MEMBERSHIP_REQUIRED';
  end if;

  select response.status
  into previous_status
  from public.room_event_rsvps response
  where response.event_id = target_event_id
    and response.occurrence_start = target_occurrence_start
    and response.user_id = target_user_id
  for update;

  if target_status = 'none' then
    delete from public.room_event_rsvps response
    where response.event_id = target_event_id
      and response.occurrence_start = target_occurrence_start
      and response.user_id = target_user_id;
    resolved_status := 'none';
  else
    resolved_status := target_status;

    if target_status = 'going' and event_row.capacity is not null then
      select count(*)::integer
      into going_count
      from public.room_event_rsvps response
      where response.event_id = target_event_id
        and response.occurrence_start = target_occurrence_start
        and response.status = 'going'
        and response.user_id <> target_user_id;

      if going_count >= event_row.capacity then
        resolved_status := 'waitlist';
      end if;
    end if;

    insert into public.room_event_rsvps (
      room_id,
      event_id,
      occurrence_start,
      user_id,
      status,
      note
    ) values (
      event_row.room_id,
      target_event_id,
      target_occurrence_start,
      target_user_id,
      resolved_status,
      left(coalesce(target_note, ''), 500)
    )
    on conflict (event_id, occurrence_start, user_id)
    do update set
      status = excluded.status,
      note = excluded.note,
      updated_at = now();
  end if;

  if previous_status = 'going' and resolved_status <> 'going' then
    select response.user_id
    into promoted_user_id
    from public.room_event_rsvps response
    where response.event_id = target_event_id
      and response.occurrence_start = target_occurrence_start
      and response.status = 'waitlist'
    order by response.updated_at asc, response.created_at asc, response.user_id asc
    for update skip locked
    limit 1;

    if promoted_user_id is not null then
      update public.room_event_rsvps response
      set status = 'going', updated_at = now()
      where response.event_id = target_event_id
        and response.occurrence_start = target_occurrence_start
        and response.user_id = promoted_user_id;
    end if;
  end if;

  return resolved_status;
end;
$$;

revoke all on function public.set_room_event_rsvp(
  uuid, uuid, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.set_room_event_rsvp(
  uuid, uuid, timestamptz, text, text
) to service_role;

create or replace function public.capture_room_calendar_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_name text;
  activity_title text;
  activity_importance text;
  activity_actor uuid;
begin
  if tg_op = 'INSERT' then
    activity_name := 'calendar_event_created';
    activity_title := new.title;
    activity_importance := 'normal';
    activity_actor := new.created_by;
  else
    if new.title is not distinct from old.title
      and new.description is not distinct from old.description
      and new.location is not distinct from old.location
      and new.starts_at is not distinct from old.starts_at
      and new.ends_at is not distinct from old.ends_at
      and new.recurrence_rule is not distinct from old.recurrence_rule
      and new.recurrence_until is not distinct from old.recurrence_until
      and new.timezone is not distinct from old.timezone
      and new.capacity is not distinct from old.capacity
      and new.registration_required is not distinct from old.registration_required
      and new.status is not distinct from old.status
      and new.all_day is not distinct from old.all_day
      and new.online_url is not distinct from old.online_url
    then
      return new;
    end if;

    if new.status = 'cancelled' and old.status is distinct from new.status then
      activity_name := 'calendar_event_cancelled';
      activity_title := 'Event cancelled: ' || new.title;
      activity_importance := 'high';
    else
      activity_name := 'calendar_event_updated';
      activity_title := 'Event updated: ' || new.title;
      activity_importance := 'normal';
    end if;
    activity_actor := coalesce(new.updated_by, new.cancelled_by, new.created_by);
  end if;

  perform public.insert_room_activity_event(
    new.room_id,
    activity_actor,
    activity_name,
    'calendar',
    'room_event',
    new.id,
    activity_title,
    concat_ws(' · ', nullif(new.description, ''), nullif(new.location, '')),
    'all',
    activity_importance,
    jsonb_build_object(
      'startsAt', new.starts_at,
      'endsAt', new.ends_at,
      'timezone', new.timezone,
      'status', new.status,
      'allDay', new.all_day,
      'recurrenceRule', new.recurrence_rule
    )
  );
  return new;
end;
$$;

drop trigger if exists capture_room_calendar_activity_trigger on public.room_events;
create trigger capture_room_calendar_activity_trigger
after insert or update of
  title,
  description,
  location,
  starts_at,
  ends_at,
  recurrence_rule,
  recurrence_until,
  timezone,
  capacity,
  registration_required,
  status,
  all_day,
  online_url
on public.room_events
for each row execute function public.capture_room_calendar_activity();

create or replace function public.create_room_signal_inbox_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_name text;
  v_room_type text;
  v_notification_type text;
  v_preference_kind text;
  v_message text;
  v_rsvp_only boolean := false;
begin
  if new.audience <> 'all' then
    return new;
  end if;

  if new.event_type = 'discussion_created' then
    v_notification_type := 'room_discussion';
    v_preference_kind := 'new_discussions';
  elsif new.event_type = 'announcement_created' then
    v_notification_type := 'room_announcement';
    v_preference_kind := 'announcements';
  elsif new.event_type in (
    'calendar_event_created',
    'calendar_event_updated',
    'calendar_event_cancelled'
  ) then
    v_notification_type := 'room_event';
    v_preference_kind := 'events';
    v_rsvp_only := new.event_type = 'calendar_event_cancelled';
  else
    return new;
  end if;

  select
    coalesce(nullif(btrim(room.name), ''), 'Room'),
    lower(replace(coalesce(room.room_type, ''), ' ', '_'))
  into v_room_name, v_room_type
  from public.rooms room
  where room.id = new.room_id;

  if v_room_name is null then
    return new;
  end if;

  if new.event_type = 'discussion_created'
    and v_room_type in ('customer_support', 'customer-support')
  then
    return new;
  end if;

  v_message := case new.event_type
    when 'discussion_created' then
      'New discussion in ' || v_room_name || ': ' || left(new.title, 160)
    when 'announcement_created' then
      'New announcement in ' || v_room_name || ': ' || left(new.title, 160)
    when 'calendar_event_updated' then
      'Event updated in ' || v_room_name || ': ' || left(new.title, 180)
    when 'calendar_event_cancelled' then
      'Event cancelled in ' || v_room_name || ': ' || left(new.title, 180)
    else
      'New event in ' || v_room_name || ': ' || left(new.title, 180)
  end;

  insert into public.notifications (
    user_id,
    actor_id,
    type,
    target_type,
    target_id,
    room_id,
    message
  )
  select
    recipient.user_id,
    new.actor_id,
    v_notification_type,
    new.target_type,
    new.target_id,
    new.room_id,
    v_message
  from (
    select distinct candidate.user_id
    from (
      select member.user_id
      from public.room_members member
      where member.room_id = new.room_id
        and lower(coalesce(member.status, 'active')) not in (
          'blocked', 'removed', 'inactive', 'suspended'
        )
        and (member.suspended_until is null or member.suspended_until <= now())
      union all
      select room.owner_id
      from public.rooms room
      where room.id = new.room_id
      union all
      select room.created_by
      from public.rooms room
      where room.id = new.room_id
    ) candidate
    where candidate.user_id is not null
  ) recipient
  left join public.room_notification_preferences preference
    on preference.room_id = new.room_id
   and preference.user_id = recipient.user_id
  where recipient.user_id is distinct from new.actor_id
    and not coalesce(preference.muted, false)
    and (
      not coalesce(preference.important_only, false)
      or new.importance = 'high'
    )
    and (
      not v_rsvp_only
      or exists (
        select 1
        from public.room_event_rsvps response
        where response.event_id = new.target_id
          and response.user_id = recipient.user_id
          and response.status in ('going', 'maybe', 'waitlist')
      )
    )
    and (
      v_rsvp_only
      or case v_preference_kind
        when 'new_discussions' then
          coalesce(preference.new_discussions_enabled, false)
        when 'announcements' then
          coalesce(preference.announcements_enabled, true)
        else
          coalesce(preference.events_enabled, true)
      end
    );

  return new;
end;
$$;

notify pgrst, 'reload schema';

commit;
