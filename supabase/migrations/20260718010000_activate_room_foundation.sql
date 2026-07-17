-- Room activity, unread state, preferences, and private cross-module search.

begin;

create table if not exists public.room_activity_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  module_key text not null,
  target_type text not null,
  target_id uuid,
  title text not null,
  summary text not null default '',
  audience text not null default 'all',
  importance text not null default 'normal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint room_activity_events_audience_check
    check (audience in ('all', 'managers', 'owner', 'actor')),
  constraint room_activity_events_importance_check
    check (importance in ('normal', 'high')),
  constraint room_activity_events_title_length_check
    check (char_length(title) between 1 and 240),
  constraint room_activity_events_summary_length_check
    check (char_length(summary) <= 1000)
);

create index if not exists room_activity_events_room_created_idx
  on public.room_activity_events (room_id, created_at desc);
create index if not exists room_activity_events_room_module_created_idx
  on public.room_activity_events (room_id, module_key, created_at desc);
create index if not exists room_activity_events_actor_created_idx
  on public.room_activity_events (actor_id, created_at desc);

create table if not exists public.room_notification_preferences (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  muted boolean not null default false,
  important_only boolean not null default false,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_notification_preferences_user_idx
  on public.room_notification_preferences (user_id, updated_at desc);

create or replace function public.touch_room_foundation_updated_at()
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

drop trigger if exists touch_room_notification_preferences_updated_at
  on public.room_notification_preferences;
create trigger touch_room_notification_preferences_updated_at
before update on public.room_notification_preferences
for each row execute function public.touch_room_foundation_updated_at();

alter table public.room_activity_events enable row level security;
alter table public.room_notification_preferences enable row level security;

drop policy if exists "Room activity is visible to active members"
  on public.room_activity_events;
create policy "Room activity is visible to active members"
on public.room_activity_events
for select
to authenticated
using (
  public.user_is_active_room_member(room_id)
  and (
    audience = 'all'
    or (audience = 'managers' and public.user_can_manage_live_room(room_id))
    or (
      audience = 'owner'
      and exists (
        select 1
        from public.rooms room
        where room.id = room_activity_events.room_id
          and (room.owner_id = auth.uid() or room.created_by = auth.uid())
      )
    )
    or (audience = 'actor' and actor_id = auth.uid())
  )
);

drop policy if exists "Members manage their own Room notification preferences"
  on public.room_notification_preferences;
create policy "Members manage their own Room notification preferences"
on public.room_notification_preferences
for all
to authenticated
using (
  user_id = auth.uid()
  and public.user_is_active_room_member(room_id)
)
with check (
  user_id = auth.uid()
  and public.user_is_active_room_member(room_id)
);

revoke all on table public.room_activity_events from anon;
revoke all on table public.room_notification_preferences from anon;
revoke insert, update, delete on table public.room_activity_events from authenticated;
grant select on table public.room_activity_events to authenticated;
grant select, insert, update, delete
  on table public.room_notification_preferences
  to authenticated;

create or replace function public.insert_room_activity_event(
  target_room_id uuid,
  activity_actor_id uuid,
  activity_event_type text,
  activity_module_key text,
  activity_target_type text,
  activity_target_id uuid,
  activity_title text,
  activity_summary text default '',
  activity_audience text default 'all',
  activity_importance text default 'normal',
  activity_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  insert into public.room_activity_events (
    room_id,
    actor_id,
    event_type,
    module_key,
    target_type,
    target_id,
    title,
    summary,
    audience,
    importance,
    metadata
  )
  values (
    target_room_id,
    activity_actor_id,
    left(coalesce(nullif(trim(activity_event_type), ''), 'room_activity'), 80),
    left(coalesce(nullif(trim(activity_module_key), ''), 'overview'), 80),
    left(coalesce(nullif(trim(activity_target_type), ''), 'room'), 80),
    activity_target_id,
    left(coalesce(nullif(trim(activity_title), ''), 'Room activity'), 240),
    left(coalesce(activity_summary, ''), 1000),
    case
      when activity_audience in ('all', 'managers', 'owner', 'actor')
        then activity_audience
      else 'all'
    end,
    case when activity_importance = 'high' then 'high' else 'normal' end,
    coalesce(activity_metadata, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.insert_room_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.insert_room_activity_event(
  uuid, uuid, text, text, text, uuid, text, text, text, text, jsonb
) to service_role;

create or replace function public.capture_room_post_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_room_activity_event(
    new.room_id,
    new.author_id,
    'discussion_created',
    'discussions',
    'room_post',
    new.id,
    coalesce(nullif(new.title, ''), 'New Room discussion'),
    new.body,
    'all',
    'normal',
    '{}'::jsonb
  );
  return new;
end;
$$;

drop trigger if exists capture_room_post_activity_trigger on public.room_posts;
create trigger capture_room_post_activity_trigger
after insert on public.room_posts
for each row execute function public.capture_room_post_activity();

create or replace function public.capture_room_calendar_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_room_activity_event(
    new.room_id,
    new.created_by,
    'calendar_event_created',
    'calendar',
    'room_event',
    new.id,
    new.title,
    concat_ws(' · ', nullif(new.description, ''), nullif(new.location, '')),
    'all',
    'normal',
    jsonb_build_object('startsAt', new.starts_at, 'endsAt', new.ends_at)
  );
  return new;
end;
$$;

drop trigger if exists capture_room_calendar_activity_trigger on public.room_events;
create trigger capture_room_calendar_activity_trigger
after insert on public.room_events
for each row execute function public.capture_room_calendar_activity();

create or replace function public.capture_room_announcement_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_room_activity_event(
    new.room_id,
    new.created_by,
    'announcement_created',
    'announcements',
    'room_announcement',
    new.id,
    new.title,
    new.body,
    'all',
    case
      when new.priority in ('high', 'urgent') or new.is_pinned then 'high'
      else 'normal'
    end,
    jsonb_build_object('priority', new.priority, 'isPinned', new.is_pinned)
  );
  return new;
end;
$$;

drop trigger if exists capture_room_announcement_activity_trigger
  on public.room_announcements;
create trigger capture_room_announcement_activity_trigger
after insert on public.room_announcements
for each row execute function public.capture_room_announcement_activity();

create or replace function public.capture_room_module_record_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  exposed_module text;
  event_name text;
begin
  exposed_module := case new.module_key
    when 'resource' then 'resources'
    when 'task' then 'tasks'
    when 'poll' then 'polls'
    when 'directory' then 'directory'
    when 'knowledge' then 'knowledge'
    when 'form' then 'forms'
    when 'service' then 'services'
    when 'workflow' then 'member-workflows'
    else new.module_key
  end;

  if tg_op = 'UPDATE'
    and new.status is not distinct from old.status
    and new.title is not distinct from old.title
    and new.body is not distinct from old.body
    and new.metadata is not distinct from old.metadata
  then
    return new;
  end if;

  event_name := case
    when tg_op = 'INSERT' then exposed_module || '_created'
    when new.status = 'completed' and old.status is distinct from new.status
      then exposed_module || '_completed'
    else exposed_module || '_updated'
  end;

  perform public.insert_room_activity_event(
    new.room_id,
    new.created_by,
    event_name,
    exposed_module,
    'room_module_record',
    new.id,
    new.title,
    new.body,
    case when new.module_key = 'workflow' then 'managers' else 'all' end,
    case
      when new.module_key = 'task'
        and coalesce(new.metadata ->> 'priority', '') in ('high', 'urgent')
        then 'high'
      else 'normal'
    end,
    jsonb_build_object('status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists capture_room_module_record_activity_trigger
  on public.room_module_records;
create trigger capture_room_module_record_activity_trigger
after insert or update on public.room_module_records
for each row execute function public.capture_room_module_record_activity();

create or replace function public.capture_room_file_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_room_activity_event(
    new.room_id,
    new.uploaded_by,
    'file_uploaded',
    'files',
    'room_resource',
    new.id,
    new.file_name,
    new.mime_type,
    'all',
    'normal',
    jsonb_build_object(
      'mediaKind', new.media_kind,
      'fileSizeBytes', new.file_size_bytes
    )
  );
  return new;
end;
$$;

drop trigger if exists capture_room_file_activity_trigger on public.room_resources;
create trigger capture_room_file_activity_trigger
after insert on public.room_resources
for each row execute function public.capture_room_file_activity();

create or replace function public.capture_room_application_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_room_activity_event(
    new.room_id,
    new.applicant_id,
    'join_request_created',
    'requests',
    'room_application',
    new.id,
    'New Room join request',
    coalesce(new.note, ''),
    'managers',
    'high',
    jsonb_build_object('state', new.state)
  );
  return new;
end;
$$;

drop trigger if exists capture_room_application_activity_trigger
  on public.room_applications;
create trigger capture_room_application_activity_trigger
after insert on public.room_applications
for each row execute function public.capture_room_application_activity();

create or replace function public.capture_room_membership_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_name text;
  activity_title text;
begin
  if tg_op = 'INSERT' then
    activity_name := 'member_joined';
    activity_title := 'A member joined the Room';
  elsif new.role is distinct from old.role then
    activity_name := 'member_role_changed';
    activity_title := 'A Room member role changed';
  elsif new.status is distinct from old.status then
    activity_name := 'member_status_changed';
    activity_title := 'A Room membership status changed';
  else
    return new;
  end if;

  perform public.insert_room_activity_event(
    new.room_id,
    new.user_id,
    activity_name,
    'members',
    'room_member',
    new.id,
    activity_title,
    '',
    'all',
    'normal',
    jsonb_build_object('role', new.role, 'status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists capture_room_membership_activity_trigger
  on public.room_members;
create trigger capture_room_membership_activity_trigger
after insert or update on public.room_members
for each row execute function public.capture_room_membership_activity();

create or replace function public.capture_room_invite_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.insert_room_activity_event(
    new.room_id,
    new.created_by,
    'invite_created',
    'invites',
    'room_invite',
    new.id,
    coalesce(new.label, 'Room invitation'),
    '',
    'managers',
    'normal',
    jsonb_build_object(
      'role', new.role,
      'expiresAt', new.expires_at,
      'maxUses', new.max_uses
    )
  );
  return new;
end;
$$;

drop trigger if exists capture_room_invite_activity_trigger on public.room_invites;
create trigger capture_room_invite_activity_trigger
after insert on public.room_invites
for each row execute function public.capture_room_invite_activity();

create or replace function public.capture_room_module_response_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_record public.room_module_records%rowtype;
  exposed_module text;
begin
  select *
  into parent_record
  from public.room_module_records
  where id = new.record_id
    and room_id = new.room_id;

  if not found then
    return new;
  end if;

  exposed_module := case parent_record.module_key
    when 'poll' then 'polls'
    when 'form' then 'forms'
    else parent_record.module_key
  end;

  perform public.insert_room_activity_event(
    new.room_id,
    new.responder_id,
    case
      when parent_record.module_key = 'poll' then 'poll_response_recorded'
      when parent_record.module_key = 'form' then 'form_submission_received'
      else 'module_response_recorded'
    end,
    exposed_module,
    'room_module_response',
    new.id,
    case
      when parent_record.module_key = 'poll' then 'A Room poll received a response'
      when parent_record.module_key = 'form' then 'A Room form received a submission'
      else 'A Room item received a response'
    end,
    parent_record.title,
    case when parent_record.module_key = 'form' then 'managers' else 'all' end,
    'normal',
    jsonb_build_object('recordId', parent_record.id)
  );
  return new;
end;
$$;

drop trigger if exists capture_room_module_response_activity_trigger
  on public.room_module_responses;
create trigger capture_room_module_response_activity_trigger
after insert on public.room_module_responses
for each row execute function public.capture_room_module_response_activity();

create or replace function public.search_room_content(
  target_room_id uuid,
  search_text text,
  module_filter text default null,
  result_limit integer default 50
)
returns table (
  module_key text,
  target_type text,
  target_id uuid,
  title text,
  snippet text,
  created_at timestamptz,
  rank real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean_query text := trim(coalesce(search_text, ''));
  capped_limit integer := least(greatest(coalesce(result_limit, 50), 1), 100);
begin
  if char_length(clean_query) < 2 then
    return;
  end if;

  return query
  with searchable as (
    select
      post.room_id,
      'discussions'::text as module_key,
      'room_post'::text as target_type,
      post.id as target_id,
      coalesce(nullif(post.title, ''), 'Room discussion') as title,
      post.body as searchable_text,
      post.created_at
    from public.room_posts post
    where post.room_id = target_room_id
      and post.deleted_at is null

    union all

    select
      event.room_id,
      'calendar',
      'room_event',
      event.id,
      event.title,
      concat_ws(' ', event.description, event.location),
      event.created_at
    from public.room_events event
    where event.room_id = target_room_id

    union all

    select
      announcement.room_id,
      'announcements',
      'room_announcement',
      announcement.id,
      announcement.title,
      announcement.body,
      announcement.created_at
    from public.room_announcements announcement
    where announcement.room_id = target_room_id

    union all

    select
      record.room_id,
      case record.module_key
        when 'resource' then 'resources'
        when 'task' then 'tasks'
        when 'poll' then 'polls'
        when 'directory' then 'directory'
        when 'knowledge' then 'knowledge'
        when 'form' then 'forms'
        when 'service' then 'services'
        when 'workflow' then 'member-workflows'
        else record.module_key
      end,
      'room_module_record',
      record.id,
      record.title,
      concat_ws(' ', record.body, record.metadata::text),
      record.created_at
    from public.room_module_records record
    where record.room_id = target_room_id
      and record.archived_at is null

    union all

    select
      resource.room_id,
      'files',
      'room_resource',
      resource.id,
      resource.file_name,
      concat_ws(' ', resource.mime_type, resource.media_kind),
      resource.created_at
    from public.room_resources resource
    where resource.room_id = target_room_id
  ),
  scored as (
    select
      content.module_key,
      content.target_type,
      content.target_id,
      content.title,
      left(coalesce(content.searchable_text, ''), 500) as snippet,
      content.created_at,
      ts_rank_cd(
        to_tsvector(
          'simple',
          concat_ws(' ', content.title, content.searchable_text)
        ),
        websearch_to_tsquery('simple', clean_query)
      )::real as rank
    from searchable content
    where
      (module_filter is null or module_filter = '' or content.module_key = module_filter)
      and (
        to_tsvector(
          'simple',
          concat_ws(' ', content.title, content.searchable_text)
        ) @@ websearch_to_tsquery('simple', clean_query)
        or content.title ilike '%' || clean_query || '%'
        or content.searchable_text ilike '%' || clean_query || '%'
      )
  )
  select
    scored.module_key,
    scored.target_type,
    scored.target_id,
    scored.title,
    scored.snippet,
    scored.created_at,
    scored.rank
  from scored
  order by scored.rank desc, scored.created_at desc
  limit capped_limit;
end;
$$;

revoke all on function public.search_room_content(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.search_room_content(uuid, text, text, integer)
  to service_role;

do $$
begin
  alter publication supabase_realtime add table public.room_activity_events;
exception
  when duplicate_object then null;
end;
$$;

notify pgrst, 'reload schema';

commit;
