-- Loombus Report Creation Cooldown
-- Date: 2026-05-22
--
-- Purpose:
-- Enforce a durable database-level cooldown for report creation.
-- This protects the reports table even when reports are inserted directly
-- from client-side Supabase calls.

create or replace function public.enforce_report_create_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reporter_id is null then
    raise exception 'Reporter id is required.';
  end if;

  if exists (
    select 1
    from public.action_rate_events
    where user_id = new.reporter_id
      and action_key = 'report_create'
      and created_at >= now() - interval '15 seconds'
    limit 1
  ) then
    raise exception 'Please wait before submitting another report.';
  end if;

  insert into public.action_rate_events (
    user_id,
    action_key,
    target_id
  )
  values (
    new.reporter_id,
    'report_create',
    coalesce(new.reported_profile_id, new.reply_id, new.discussion_id)
  );

  return new;
end;
$$;

drop trigger if exists enforce_report_create_cooldown_trigger
on public.reports;

create trigger enforce_report_create_cooldown_trigger
before insert on public.reports
for each row
execute function public.enforce_report_create_cooldown();

-- Verification
select
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'reports'
  and trigger_name = 'enforce_report_create_cooldown_trigger';

select
  proname,
  prosecdef
from pg_proc
where proname = 'enforce_report_create_cooldown';
