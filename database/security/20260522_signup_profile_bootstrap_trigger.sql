-- Loombus Signup Profile Bootstrap Trigger
-- Goal:
-- - Create a public.profiles row automatically when auth.users receives a new user.
-- - Remove the need for direct client-side profile insert during email signup.
-- - Support email and OAuth signups through the same database path.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_full_name text;
begin
  clean_full_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');

  insert into public.profiles (
    id,
    full_name
  )
  values (
    new.id,
    clean_full_name
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile
on auth.users;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

comment on function public.handle_new_user_profile() is
'Creates the initial public profile row for new Loombus auth users.';

-- Verification: trigger should exist on auth.users.
select
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_timing
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
  and trigger_name = 'on_auth_user_created_create_profile';

-- Verification: function should be security definer.
select
  proname,
  prosecdef
from pg_proc
where proname = 'handle_new_user_profile';
