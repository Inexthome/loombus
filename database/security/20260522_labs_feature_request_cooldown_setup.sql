-- Loombus Labs Feature Request Cooldown
-- Adds a durable database-level cooldown for Labs feature request creation.
-- This protects public.labs_feature_requests even if a client bypasses the UI/API.

create or replace function public.enforce_labs_feature_request_create_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required to submit Labs feature requests.';
  end if;

  if new.user_id <> auth.uid() then
    raise exception 'Labs feature request user_id must match the authenticated user.';
  end if;

  if exists (
    select 1
    from public.labs_feature_requests
    where user_id = new.user_id
      and created_at > now() - interval '30 seconds'
    limit 1
  ) then
    raise exception 'Please wait before submitting another Labs feature request.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_labs_feature_request_create_cooldown_trigger
on public.labs_feature_requests;

create trigger enforce_labs_feature_request_create_cooldown_trigger
before insert on public.labs_feature_requests
for each row
execute function public.enforce_labs_feature_request_create_cooldown();

-- Verification: trigger should exist.
select
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'labs_feature_requests'
  and trigger_name = 'enforce_labs_feature_request_create_cooldown_trigger';

-- Verification: function should exist.
select
  proname,
  prosecdef
from pg_proc
where proname = 'enforce_labs_feature_request_create_cooldown';
