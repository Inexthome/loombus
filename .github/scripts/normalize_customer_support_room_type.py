from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"Missing normalization target: {label}")
    return source.replace(old, new, 1)


path = Path("supabase/migrations/20260725013000_enforce_customer_support_thread_isolation.sql")
source = path.read_text()
source = replace_once(
    source,
    """alter table public.room_posts
  add constraint room_posts_visibility_scope_check
  check (visibility_scope in ('room', 'author_and_staff'));

update public.room_posts post
""",
    """alter table public.room_posts
  add constraint room_posts_visibility_scope_check
  check (visibility_scope in ('room', 'author_and_staff'));

create or replace function public.room_type_is_customer_support(value text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(
    regexp_replace(btrim(coalesce(value, '')), '[-[:space:]]+', '_', 'g')
  ) = 'customer_support';
$$;

update public.room_posts post
""",
    "Customer Support Room type helper",
)
source = source.replace(
    "when room.room_type = 'customer_support' then 'author_and_staff'",
    "when public.room_type_is_customer_support(room.room_type) then 'author_and_staff'",
)
source = source.replace(
    "if target_room_type = 'customer_support' then",
    "if public.room_type_is_customer_support(target_room_type) then",
)
source = replace_once(
    source,
    """  if old.room_type = 'customer_support'
     and new.room_type is distinct from 'customer_support' then
""",
    """  if public.room_type_is_customer_support(old.room_type)
     and not public.room_type_is_customer_support(new.room_type) then
""",
    "support Room conversion-out guard",
)
source = replace_once(
    source,
    """  if old.room_type is distinct from 'customer_support'
     and new.room_type = 'customer_support' then
""",
    """  if not public.room_type_is_customer_support(old.room_type)
     and public.room_type_is_customer_support(new.room_type) then
""",
    "support Room conversion-in guard",
)
source = replace_once(
    source,
    """revoke all on function public.room_user_is_active_member(uuid, uuid) from public;
""",
    """revoke all on function public.room_type_is_customer_support(text) from public;
revoke all on function public.room_user_is_active_member(uuid, uuid) from public;
""",
    "Room type helper revoke",
)
source = replace_once(
    source,
    """grant execute on function public.user_is_room_staff(uuid) to authenticated, service_role;
""",
    """grant execute on function public.room_type_is_customer_support(text) to service_role;
grant execute on function public.user_is_room_staff(uuid) to authenticated, service_role;
""",
    "Room type helper grant",
)

remaining_direct_checks = [
    "room.room_type = 'customer_support'",
    "target_room_type = 'customer_support'",
    "old.room_type = 'customer_support'",
    "new.room_type = 'customer_support'",
]
for check in remaining_direct_checks:
    if check in source:
        raise RuntimeError(f"Direct Customer Support Room type check remains: {check}")

path.write_text(source)
