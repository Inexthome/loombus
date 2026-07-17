-- Deepen Room tasks, decisions, forms, knowledge, calendar, and private files.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.room_task_comments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  record_id uuid not null references public.room_module_records(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_task_comments_body_length_check
    check (char_length(body) between 1 and 4000)
);

create index if not exists room_task_comments_record_created_idx
  on public.room_task_comments (record_id, created_at asc);

create index if not exists room_task_comments_room_created_idx
  on public.room_task_comments (room_id, created_at desc);

create table if not exists public.room_knowledge_versions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  record_id uuid not null references public.room_module_records(id) on delete cascade,
  version_number integer not null,
  title text not null,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint room_knowledge_versions_number_check
    check (version_number > 0),
  constraint room_knowledge_versions_title_length_check
    check (char_length(title) between 1 and 200)
);

create unique index if not exists room_knowledge_versions_record_number_unique_idx
  on public.room_knowledge_versions (record_id, version_number);

create index if not exists room_knowledge_versions_room_record_created_idx
  on public.room_knowledge_versions (room_id, record_id, created_at desc);

alter table public.room_events
  add column if not exists recurrence_rule text,
  add column if not exists recurrence_until timestamptz,
  add column if not exists timezone text not null default 'UTC',
  add column if not exists capacity integer,
  add column if not exists registration_required boolean not null default false;

create table if not exists public.room_event_rsvps (
  room_id uuid not null references public.rooms(id) on delete cascade,
  event_id uuid not null references public.room_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'going',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id),
  constraint room_event_rsvps_status_check
    check (status in ('going', 'maybe', 'declined', 'waitlist')),
  constraint room_event_rsvps_note_length_check
    check (char_length(note) <= 500)
);

create index if not exists room_event_rsvps_room_event_idx
  on public.room_event_rsvps (room_id, event_id, status);

alter table public.room_resources
  add column if not exists folder_path text not null default '/',
  add column if not exists version_group_id uuid,
  add column if not exists version_number integer not null default 1,
  add column if not exists replaces_resource_id uuid
    references public.room_resources(id) on delete set null,
  add column if not exists is_current boolean not null default true;

update public.room_resources
set version_group_id = coalesce(version_group_id, id),
    folder_path = case
      when folder_path is null or trim(folder_path) = '' then '/'
      else folder_path
    end,
    version_number = greatest(coalesce(version_number, 1), 1)
where version_group_id is null
   or folder_path is null
   or trim(folder_path) = ''
   or version_number is null
   or version_number < 1;

alter table public.room_resources
  alter column version_group_id set default gen_random_uuid(),
  alter column version_group_id set not null;

create index if not exists room_resources_room_folder_current_idx
  on public.room_resources (room_id, folder_path, created_at desc)
  where is_current = true;

create index if not exists room_resources_version_group_idx
  on public.room_resources (version_group_id, version_number desc);

create unique index if not exists room_resources_version_group_number_unique_idx
  on public.room_resources (version_group_id, version_number);

insert into public.room_knowledge_versions (
  room_id,
  record_id,
  version_number,
  title,
  body,
  metadata,
  created_by,
  created_at
)
select
  record.room_id,
  record.id,
  1,
  record.title,
  record.body,
  record.metadata,
  record.created_by,
  record.created_at
from public.room_module_records record
where record.module_key = 'knowledge'
  and not exists (
    select 1
    from public.room_knowledge_versions version
    where version.record_id = record.id
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.room_resources'::regclass
      and conname = 'room_resources_folder_length_check'
  ) then
    alter table public.room_resources
      add constraint room_resources_folder_length_check
      check (char_length(folder_path) between 1 and 500);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.room_resources'::regclass
      and conname = 'room_resources_version_number_check'
  ) then
    alter table public.room_resources
      add constraint room_resources_version_number_check
      check (version_number > 0);
  end if;
end;
$$;

create or replace function public.touch_room_expansion_updated_at()
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

drop trigger if exists touch_room_task_comments_updated_at
  on public.room_task_comments;
create trigger touch_room_task_comments_updated_at
before update on public.room_task_comments
for each row execute function public.touch_room_expansion_updated_at();

drop trigger if exists touch_room_event_rsvps_updated_at
  on public.room_event_rsvps;
create trigger touch_room_event_rsvps_updated_at
before update on public.room_event_rsvps
for each row execute function public.touch_room_expansion_updated_at();

create or replace function public.capture_room_knowledge_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
begin
  if new.module_key <> 'knowledge' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.title is not distinct from old.title
    and new.body is not distinct from old.body
    and new.metadata is not distinct from old.metadata
    and new.status is not distinct from old.status
  then
    return new;
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into next_version
  from public.room_knowledge_versions version
  where version.record_id = new.id;

  insert into public.room_knowledge_versions (
    room_id,
    record_id,
    version_number,
    title,
    body,
    metadata,
    created_by
  )
  values (
    new.room_id,
    new.id,
    next_version,
    new.title,
    new.body,
    new.metadata,
    new.created_by
  )
  on conflict (record_id, version_number) do nothing;

  return new;
end;
$$;

drop trigger if exists capture_room_knowledge_version_trigger
  on public.room_module_records;
create trigger capture_room_knowledge_version_trigger
after insert or update on public.room_module_records
for each row execute function public.capture_room_knowledge_version();

create or replace function public.capture_room_task_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_title text;
begin
  select record.title
  into task_title
  from public.room_module_records record
  where record.id = new.record_id
    and record.room_id = new.room_id
    and record.module_key = 'task';

  if task_title is null then
    return new;
  end if;

  perform public.insert_room_activity_event(
    new.room_id,
    new.author_id,
    'task_comment_added',
    'tasks',
    'room_task_comment',
    new.id,
    'Comment added to ' || task_title,
    new.body,
    'all',
    'normal',
    jsonb_build_object('recordId', new.record_id)
  );

  return new;
end;
$$;

drop trigger if exists capture_room_task_comment_activity_trigger
  on public.room_task_comments;
create trigger capture_room_task_comment_activity_trigger
after insert on public.room_task_comments
for each row execute function public.capture_room_task_comment_activity();

create or replace function public.promote_previous_room_resource_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_current then
    update public.room_resources resource
    set is_current = true
    where resource.id = (
      select candidate.id
      from public.room_resources candidate
      where candidate.version_group_id = old.version_group_id
        and candidate.id <> old.id
      order by candidate.version_number desc, candidate.created_at desc
      limit 1
    );
  end if;

  return old;
end;
$$;

drop trigger if exists promote_previous_room_resource_version_trigger
  on public.room_resources;
create trigger promote_previous_room_resource_version_trigger
after delete on public.room_resources
for each row execute function public.promote_previous_room_resource_version();

alter table public.room_task_comments enable row level security;
alter table public.room_knowledge_versions enable row level security;
alter table public.room_event_rsvps enable row level security;

revoke all on table public.room_task_comments from anon, authenticated;
revoke all on table public.room_knowledge_versions from anon, authenticated;
revoke all on table public.room_event_rsvps from anon, authenticated;

notify pgrst, 'reload schema';

commit;
