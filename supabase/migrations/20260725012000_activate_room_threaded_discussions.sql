-- Activate structured, threaded Room discussions without public Topic taxonomy.
-- Existing room_posts become Open Discussions and remain readable.

begin;

alter table public.room_posts
  add column if not exists discussion_type text not null default 'open_discussion',
  add column if not exists discussion_metadata jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'open',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists reply_count integer not null default 0;

update public.room_posts
set last_activity_at = coalesce(updated_at, created_at, now())
where last_activity_at is null
   or last_activity_at < created_at;

alter table public.room_posts
  drop constraint if exists room_posts_discussion_type_check,
  drop constraint if exists room_posts_discussion_metadata_object_check,
  drop constraint if exists room_posts_status_check,
  drop constraint if exists room_posts_resolution_state_check,
  drop constraint if exists room_posts_reply_count_check;

alter table public.room_posts
  add constraint room_posts_discussion_type_check
    check (
      discussion_type in (
        'open_discussion',
        'debate',
        'research_question',
        'problem_solving'
      )
    ),
  add constraint room_posts_discussion_metadata_object_check
    check (jsonb_typeof(discussion_metadata) = 'object'),
  add constraint room_posts_status_check
    check (status in ('open', 'resolved')),
  add constraint room_posts_resolution_state_check
    check (
      (status = 'open' and resolved_at is null and resolved_by is null)
      or
      (status = 'resolved' and resolved_at is not null)
    ),
  add constraint room_posts_reply_count_check
    check (reply_count >= 0);

create unique index if not exists room_posts_id_room_unique_idx
  on public.room_posts (id, room_id);
create index if not exists room_posts_room_activity_idx
  on public.room_posts (room_id, last_activity_at desc)
  where deleted_at is null;
create index if not exists room_posts_room_status_activity_idx
  on public.room_posts (room_id, status, last_activity_at desc)
  where deleted_at is null;

create table if not exists public.room_post_replies (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  post_id uuid not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  deletion_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_post_replies_post_room_fk
    foreign key (post_id, room_id)
    references public.room_posts(id, room_id)
    on delete cascade,
  constraint room_post_replies_body_length_check
    check (char_length(btrim(body)) between 1 and 3000)
);

create index if not exists room_post_replies_post_created_idx
  on public.room_post_replies (post_id, created_at asc)
  where deleted_at is null;
create index if not exists room_post_replies_room_created_idx
  on public.room_post_replies (room_id, created_at desc)
  where deleted_at is null;
create index if not exists room_post_replies_author_idx
  on public.room_post_replies (author_id, created_at desc);

create table if not exists public.room_post_reads (
  room_id uuid not null references public.rooms(id) on delete cascade,
  post_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (post_id, user_id),
  constraint room_post_reads_post_room_fk
    foreign key (post_id, room_id)
    references public.room_posts(id, room_id)
    on delete cascade
);

create index if not exists room_post_reads_user_room_idx
  on public.room_post_reads (user_id, room_id, last_read_at desc);

create or replace function public.touch_room_post_reply_updated_at()
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

drop trigger if exists touch_room_post_replies_updated_at
  on public.room_post_replies;
create trigger touch_room_post_replies_updated_at
before update on public.room_post_replies
for each row execute function public.touch_room_post_reply_updated_at();

create or replace function public.recompute_room_post_thread(target_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.room_posts post
  set
    reply_count = reply_stats.reply_count,
    last_activity_at = greatest(
      post.created_at,
      coalesce(reply_stats.last_reply_at, post.created_at)
    )
  from (
    select
      count(*) filter (where reply.deleted_at is null)::integer as reply_count,
      max(reply.created_at) filter (where reply.deleted_at is null) as last_reply_at
    from public.room_post_replies reply
    where reply.post_id = target_post_id
  ) reply_stats
  where post.id = target_post_id;
end;
$$;

create or replace function public.refresh_room_post_thread_after_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_room_post_thread(old.post_id);
    return old;
  end if;

  perform public.recompute_room_post_thread(new.post_id);
  if tg_op = 'UPDATE' and old.post_id is distinct from new.post_id then
    perform public.recompute_room_post_thread(old.post_id);
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_room_post_thread_after_reply_trigger
  on public.room_post_replies;
create trigger refresh_room_post_thread_after_reply_trigger
after insert or update or delete on public.room_post_replies
for each row execute function public.refresh_room_post_thread_after_reply();

create or replace function public.enforce_room_reply_participation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  target_status text;
  member_posts_allowed boolean;
begin
  select post.room_id, post.status
  into target_room_id, target_status
  from public.room_posts post
  where post.id = new.post_id
    and post.deleted_at is null;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'The Room discussion does not exist.';
  end if;

  if new.room_id is distinct from target_room_id then
    raise exception using
      errcode = '23514',
      message = 'The reply Room does not match the discussion Room.';
  end if;

  if target_status = 'resolved' then
    raise exception using
      errcode = '23514',
      message = 'Resolved Room discussions must be reopened before replying.';
  end if;

  select coalesce(
    case
      when settings.settings ->> 'allowMemberPosts' in ('true', 'false')
        then (settings.settings ->> 'allowMemberPosts')::boolean
      else true
    end,
    true
  )
  into member_posts_allowed
  from public.room_module_settings settings
  where settings.room_id = new.room_id;

  if coalesce(member_posts_allowed, true) then
    return new;
  end if;

  if exists (
    select 1
    from public.rooms room
    where room.id = new.room_id
      and (room.owner_id = new.author_id or room.created_by = new.author_id)
  ) then
    return new;
  end if;

  if exists (
    select 1
    from public.room_members member
    where member.room_id = new.room_id
      and member.user_id = new.author_id
      and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive')
      and member.role in ('owner', 'admin', 'administrator', 'moderator')
  ) then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = 'Room member discussions are disabled by Room administrators.';
end;
$$;

drop trigger if exists enforce_room_reply_participation_trigger
  on public.room_post_replies;
create trigger enforce_room_reply_participation_trigger
before insert on public.room_post_replies
for each row execute function public.enforce_room_reply_participation();

alter table public.room_post_replies enable row level security;
alter table public.room_post_reads enable row level security;

drop policy if exists "Room replies are visible to active members"
  on public.room_post_replies;
create policy "Room replies are visible to active members"
on public.room_post_replies
for select
to authenticated
using (
  deleted_at is null
  and public.user_is_active_room_member(room_id)
  and exists (
    select 1
    from public.room_posts post
    where post.id = room_post_replies.post_id
      and post.room_id = room_post_replies.room_id
      and post.deleted_at is null
  )
);

drop policy if exists "Members can read their Room thread markers"
  on public.room_post_reads;
create policy "Members can read their Room thread markers"
on public.room_post_reads
for select
to authenticated
using (
  user_id = auth.uid()
  and public.user_is_active_room_member(room_id)
);

drop policy if exists "Members can create their Room thread markers"
  on public.room_post_reads;
create policy "Members can create their Room thread markers"
on public.room_post_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.user_is_active_room_member(room_id)
);

drop policy if exists "Members can update their Room thread markers"
  on public.room_post_reads;
create policy "Members can update their Room thread markers"
on public.room_post_reads
for update
to authenticated
using (
  user_id = auth.uid()
  and public.user_is_active_room_member(room_id)
)
with check (
  user_id = auth.uid()
  and public.user_is_active_room_member(room_id)
);

revoke all on table public.room_post_replies from anon;
revoke all on table public.room_post_reads from anon;
grant select on table public.room_post_replies to authenticated;
grant select, insert, update on table public.room_post_reads to authenticated;
revoke insert, update, delete on table public.room_post_replies from authenticated;
revoke delete on table public.room_post_reads from authenticated;

comment on column public.room_posts.discussion_type is
  'Room discussion mode. Room discussions intentionally do not use public Topics.';
comment on column public.room_posts.discussion_metadata is
  'Validated structured fields for the selected Room discussion mode.';
comment on column public.room_posts.status is
  'Thread workflow state: open or resolved.';
comment on table public.room_post_replies is
  'Flat replies inside a private Room discussion thread.';
comment on table public.room_post_reads is
  'Per-member Room thread read markers used for unread activity.';

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_post_replies'
  ) then
    alter publication supabase_realtime add table public.room_post_replies;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
