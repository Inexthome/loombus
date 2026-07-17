-- Enforce Room participation and module privacy controls at the database boundary.
-- Apply after 20260717010000_activate_room_tier_modules.sql.

begin;

-- Tier modules are read and mutated through the authenticated server API. This
-- prevents a custom browser client from bypassing plan downgrades, role checks,
-- private-directory controls, response privacy, or audit filtering.
revoke all on table public.room_module_records from authenticated;
revoke all on table public.room_module_responses from authenticated;
revoke all on table public.room_module_settings from authenticated;
revoke all on table public.room_invites from authenticated;

create or replace function public.enforce_room_member_post_setting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_posts_allowed boolean;
begin
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

drop trigger if exists enforce_room_member_post_setting_trigger
  on public.room_posts;
create trigger enforce_room_member_post_setting_trigger
before insert on public.room_posts
for each row execute function public.enforce_room_member_post_setting();

notify pgrst, 'reload schema';

commit;
