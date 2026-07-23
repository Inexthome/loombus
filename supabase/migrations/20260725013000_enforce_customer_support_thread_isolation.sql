-- Enforce non-toggleable Customer Support thread isolation.
-- Customer Support cases are visible only to the author, active Room staff,
-- and active members explicitly added by staff.

begin;

alter table public.room_posts
  add column if not exists visibility_scope text not null default 'room';

alter table public.room_posts
  drop constraint if exists room_posts_visibility_scope_check;

alter table public.room_posts
  add constraint room_posts_visibility_scope_check
  check (visibility_scope in ('room', 'author_and_staff'));

update public.room_posts post
set visibility_scope = case
  when room.room_type = 'customer_support' then 'author_and_staff'
  else 'room'
end
from public.rooms room
where room.id = post.room_id
  and post.visibility_scope is distinct from case
    when room.room_type = 'customer_support' then 'author_and_staff'
    else 'room'
  end;

create table if not exists public.room_post_participants (
  room_id uuid not null references public.rooms(id) on delete cascade,
  post_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id),
  constraint room_post_participants_post_room_fk
    foreign key (post_id, room_id)
    references public.room_posts(id, room_id)
    on delete cascade
);

create index if not exists room_post_participants_room_user_idx
  on public.room_post_participants (room_id, user_id, created_at desc);
create index if not exists room_post_participants_post_created_idx
  on public.room_post_participants (post_id, created_at asc);

create or replace function public.room_user_is_active_member(
  target_room_id uuid,
  target_user_id uuid
)
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
      and member.user_id = target_user_id
      and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive')
      and (
        member.suspended_until is null
        or member.suspended_until <= now()
      )
  )
  or exists (
    select 1
    from public.rooms room
    where room.id = target_room_id
      and (room.owner_id = target_user_id or room.created_by = target_user_id)
  );
$$;

create or replace function public.room_user_is_staff(
  target_room_id uuid,
  target_user_id uuid
)
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
      and (room.owner_id = target_user_id or room.created_by = target_user_id)
  )
  or exists (
    select 1
    from public.room_members member
    where member.room_id = target_room_id
      and member.user_id = target_user_id
      and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive')
      and (
        member.suspended_until is null
        or member.suspended_until <= now()
      )
      and member.role in ('owner', 'admin', 'administrator', 'moderator')
  );
$$;

create or replace function public.user_is_room_staff(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.room_user_is_staff(target_room_id, auth.uid());
$$;

create or replace function public.user_can_access_room_post(target_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_posts post
    where post.id = target_post_id
      and post.deleted_at is null
      and (
        (
          post.visibility_scope = 'room'
          and public.room_user_is_active_member(post.room_id, auth.uid())
        )
        or
        (
          post.visibility_scope = 'author_and_staff'
          and (
            post.author_id = auth.uid()
            or public.room_user_is_staff(post.room_id, auth.uid())
            or exists (
              select 1
              from public.room_post_participants participant
              where participant.post_id = post.id
                and participant.room_id = post.room_id
                and participant.user_id = auth.uid()
                and public.room_user_is_active_member(
                  participant.room_id,
                  participant.user_id
                )
            )
          )
        )
      )
  );
$$;

create or replace function public.try_room_uuid(value text)
returns uuid
language plpgsql
immutable
strict
as $$
begin
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.enforce_room_post_required_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_type text;
begin
  select room.room_type
  into target_room_type
  from public.rooms room
  where room.id = new.room_id;

  if target_room_type is null then
    raise exception using
      errcode = '23503',
      message = 'The Room does not exist.';
  end if;

  if target_room_type = 'customer_support' then
    new.visibility_scope := 'author_and_staff';
  elsif tg_op = 'INSERT' then
    new.visibility_scope := 'room';
  elsif old.visibility_scope = 'author_and_staff' then
    -- Never widen an existing private case because of a later record update.
    new.visibility_scope := 'author_and_staff';
  else
    new.visibility_scope := 'room';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_room_post_required_visibility_trigger
  on public.room_posts;
create trigger enforce_room_post_required_visibility_trigger
before insert or update on public.room_posts
for each row execute function public.enforce_room_post_required_visibility();

create or replace function public.reconcile_room_post_visibility_after_type_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.room_type = 'customer_support'
     and new.room_type is distinct from 'customer_support' then
    raise exception using
      errcode = '23514',
      message = 'Customer Support Rooms cannot be converted to a shared Room type.';
  end if;

  if old.room_type is distinct from 'customer_support'
     and new.room_type = 'customer_support' then
    update public.room_posts
    set visibility_scope = 'author_and_staff'
    where room_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists reconcile_room_post_visibility_after_type_change_trigger
  on public.rooms;
create trigger reconcile_room_post_visibility_after_type_change_trigger
after update of room_type on public.rooms
for each row execute function public.reconcile_room_post_visibility_after_type_change();

create or replace function public.enforce_room_post_participant_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  target_visibility text;
begin
  select post.room_id, post.visibility_scope
  into target_room_id, target_visibility
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
      message = 'The participant Room does not match the discussion Room.';
  end if;

  if target_visibility <> 'author_and_staff' then
    raise exception using
      errcode = '23514',
      message = 'Explicit participants are only supported for isolated Room discussions.';
  end if;

  if not public.room_user_is_staff(new.room_id, new.added_by) then
    raise exception using
      errcode = '42501',
      message = 'Only active Room staff can add support-case participants.';
  end if;

  if not public.room_user_is_active_member(new.room_id, new.user_id) then
    raise exception using
      errcode = '42501',
      message = 'Only active Room members can be added to a support case.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_room_post_participant_contract_trigger
  on public.room_post_participants;
create trigger enforce_room_post_participant_contract_trigger
before insert or update on public.room_post_participants
for each row execute function public.enforce_room_post_participant_contract();

-- Customer Support case creation and replies are required behavior. An owner
-- setting cannot disable customers from opening or participating in their cases.
create or replace function public.enforce_room_member_post_setting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_posts_allowed boolean;
  target_room_type text;
begin
  select room.room_type
  into target_room_type
  from public.rooms room
  where room.id = new.room_id;

  if target_room_type = 'customer_support' then
    return new;
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

  if public.room_user_is_staff(new.room_id, new.author_id) then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = 'Room member discussions are disabled by Room administrators.';
end;
$$;

create or replace function public.enforce_room_reply_participation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_id uuid;
  target_status text;
  target_room_type text;
  member_posts_allowed boolean;
begin
  select post.room_id, post.status, room.room_type
  into target_room_id, target_status, target_room_type
  from public.room_posts post
  join public.rooms room on room.id = post.room_id
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

  if target_room_type = 'customer_support' then
    return new;
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

  if public.room_user_is_staff(new.room_id, new.author_id) then
    return new;
  end if;

  raise exception using
    errcode = '42501',
    message = 'Room member discussions are disabled by Room administrators.';
end;
$$;

alter table public.room_post_participants enable row level security;

-- Replace Room-wide discussion policies with thread-aware policies.
drop policy if exists "Authorized members can read Room discussions"
  on public.room_posts;
drop policy if exists "Live room posts are visible inside the room"
  on public.room_posts;
create policy "Authorized members can read Room discussions"
on public.room_posts
for select
to authenticated
using (public.user_can_access_room_post(id));

drop policy if exists "Authorized members can read Room replies"
  on public.room_post_replies;
drop policy if exists "Room replies are visible to active members"
  on public.room_post_replies;
create policy "Authorized members can read Room replies"
on public.room_post_replies
for select
to authenticated
using (
  deleted_at is null
  and public.user_can_access_room_post(post_id)
);

drop policy if exists "Members can read authorized Room thread markers"
  on public.room_post_reads;
drop policy if exists "Members can read their Room thread markers"
  on public.room_post_reads;
create policy "Members can read authorized Room thread markers"
on public.room_post_reads
for select
to authenticated
using (
  user_id = auth.uid()
  and public.user_can_access_room_post(post_id)
);

drop policy if exists "Members can create authorized Room thread markers"
  on public.room_post_reads;
drop policy if exists "Members can create their Room thread markers"
  on public.room_post_reads;
create policy "Members can create authorized Room thread markers"
on public.room_post_reads
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.user_can_access_room_post(post_id)
);

drop policy if exists "Members can update authorized Room thread markers"
  on public.room_post_reads;
drop policy if exists "Members can update their Room thread markers"
  on public.room_post_reads;
create policy "Members can update authorized Room thread markers"
on public.room_post_reads
for update
to authenticated
using (
  user_id = auth.uid()
  and public.user_can_access_room_post(post_id)
)
with check (
  user_id = auth.uid()
  and public.user_can_access_room_post(post_id)
);

drop policy if exists "Authorized members can read support-case participants"
  on public.room_post_participants;
create policy "Authorized members can read support-case participants"
on public.room_post_participants
for select
to authenticated
using (public.user_can_access_room_post(post_id));

revoke all on table public.room_post_participants from anon;
revoke insert, update, delete on table public.room_post_participants from authenticated;
grant select on table public.room_post_participants to authenticated;

-- Attachment metadata follows the parent thread's authorization boundary.
drop policy if exists "Authorized members can read post attachments"
  on public.room_post_attachments;
drop policy if exists "Room members can read post attachments"
  on public.room_post_attachments;
create policy "Authorized members can read post attachments"
on public.room_post_attachments
for select
to authenticated
using (
  public.user_can_access_room_post(post_id)
  and exists (
    select 1
    from public.room_posts post
    where post.id = room_post_attachments.post_id
      and post.room_id = room_post_attachments.room_id
  )
);

drop policy if exists "Authorized members can create post attachments"
  on public.room_post_attachments;
drop policy if exists "Room members can create post attachments"
  on public.room_post_attachments;
create policy "Authorized members can create post attachments"
on public.room_post_attachments
for insert
to authenticated
with check (
  uploader_id = auth.uid()
  and public.user_can_access_room_post(post_id)
  and exists (
    select 1
    from public.room_posts post
    where post.id = room_post_attachments.post_id
      and post.room_id = room_post_attachments.room_id
  )
);

drop policy if exists "Uploaders and Room staff can delete post attachments"
  on public.room_post_attachments;
drop policy if exists "Uploaders and room owners can delete post attachments"
  on public.room_post_attachments;
create policy "Uploaders and Room staff can delete post attachments"
on public.room_post_attachments
for delete
to authenticated
using (
  public.user_can_access_room_post(post_id)
  and (
    uploader_id = auth.uid()
    or public.user_is_room_staff(room_id)
  )
);

-- Storage paths are room_id/post_id/file. Access is derived from the post id,
-- not merely from membership in the Room.
drop policy if exists "Authorized members can read uploaded post files"
  on storage.objects;
drop policy if exists "Room members can read uploaded post files"
  on storage.objects;
create policy "Authorized members can read uploaded post files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'room-post-attachments'
  and exists (
    select 1
    from public.room_posts post
    where post.id = public.try_room_uuid((storage.foldername(name))[2])
      and post.room_id = public.try_room_uuid((storage.foldername(name))[1])
      and public.user_can_access_room_post(post.id)
  )
);

drop policy if exists "Authorized members can upload post files"
  on storage.objects;
drop policy if exists "Room members can upload post files"
  on storage.objects;
create policy "Authorized members can upload post files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'room-post-attachments'
  and owner = auth.uid()
  and exists (
    select 1
    from public.room_posts post
    where post.id = public.try_room_uuid((storage.foldername(name))[2])
      and post.room_id = public.try_room_uuid((storage.foldername(name))[1])
      and public.user_can_access_room_post(post.id)
  )
);

drop policy if exists "Uploaders and Room staff can manage uploaded post files"
  on storage.objects;
drop policy if exists "Uploaders can manage uploaded post files"
  on storage.objects;
create policy "Uploaders and Room staff can manage uploaded post files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'room-post-attachments'
  and exists (
    select 1
    from public.room_posts post
    where post.id = public.try_room_uuid((storage.foldername(name))[2])
      and post.room_id = public.try_room_uuid((storage.foldername(name))[1])
      and public.user_can_access_room_post(post.id)
      and (
        storage.objects.owner = auth.uid()
        or public.user_is_room_staff(post.room_id)
      )
  )
);

revoke all on function public.room_user_is_active_member(uuid, uuid) from public;
revoke all on function public.room_user_is_staff(uuid, uuid) from public;
revoke all on function public.user_is_room_staff(uuid) from public;
revoke all on function public.user_can_access_room_post(uuid) from public;
revoke all on function public.try_room_uuid(text) from public;

grant execute on function public.user_is_room_staff(uuid) to authenticated, service_role;
grant execute on function public.user_can_access_room_post(uuid) to authenticated, service_role;
grant execute on function public.try_room_uuid(text) to authenticated, service_role;

comment on column public.room_posts.visibility_scope is
  'Non-toggleable thread visibility derived from Room type: room or author_and_staff.';
comment on table public.room_post_participants is
  'Active Room members explicitly added by staff to isolated Customer Support cases.';

notify pgrst, 'reload schema';

commit;
