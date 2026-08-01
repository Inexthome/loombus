begin;

create extension if not exists pg_cron;

create table if not exists public.floor_live_reminder_deliveries (
  program_id uuid not null references public.floor_live_programs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_minutes integer not null,
  scheduled_for timestamptz not null,
  delivered_at timestamptz not null default now(),
  primary key (program_id, user_id, reminder_minutes, scheduled_for)
);

alter table public.floor_live_reminder_deliveries enable row level security;
revoke all on table public.floor_live_reminder_deliveries from public, anon, authenticated;
grant all on table public.floor_live_reminder_deliveries to service_role;

create or replace function public.notify_floor_live_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  program_title text;
  program_start timestamptz;
begin
  select title, starts_at into program_title, program_start
  from public.floor_live_programs
  where id = new.program_id;

  insert into public.notifications (user_id, actor_id, type, target_type, target_id, message)
  values (
    new.user_id,
    null,
    'floor_live_registered',
    'floor_live_program',
    new.program_id,
    'You are registered for ' || coalesce(program_title, 'a Floor live session') ||
      ' on ' || to_char(program_start at time zone 'America/New_York', 'Mon FMDD at FMHH12:MI AM') || ' ET.'
  );
  return new;
end;
$$;

create or replace function public.notify_floor_live_program_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notice_type text;
  notice_message text;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    notice_type := 'floor_live_cancelled';
    notice_message := new.title || ' was cancelled.';
  elsif new.status = 'live' and old.status is distinct from 'live' then
    notice_type := 'floor_live_started';
    notice_message := new.title || ' is live now.';
  elsif new.starts_at is distinct from old.starts_at then
    notice_type := 'floor_live_rescheduled';
    notice_message := new.title || ' was rescheduled to ' ||
      to_char(new.starts_at at time zone 'America/New_York', 'Mon FMDD at FMHH12:MI AM') || ' ET.';
  elsif new.title is distinct from old.title or new.meeting_url is distinct from old.meeting_url then
    notice_type := 'floor_live_updated';
    notice_message := new.title || ' session details were updated.';
  else
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, type, target_type, target_id, message)
  select registration.user_id, null, notice_type, 'floor_live_program', new.id, notice_message
  from public.floor_live_registrations registration
  where registration.program_id = new.id;

  return new;
end;
$$;

drop trigger if exists notify_floor_live_registration_trigger on public.floor_live_registrations;
create trigger notify_floor_live_registration_trigger
after insert on public.floor_live_registrations
for each row execute function public.notify_floor_live_registration();

drop trigger if exists notify_floor_live_program_change_trigger on public.floor_live_programs;
create trigger notify_floor_live_program_change_trigger
after update on public.floor_live_programs
for each row execute function public.notify_floor_live_program_change();

revoke all on function public.notify_floor_live_registration() from public, anon, authenticated;
revoke all on function public.notify_floor_live_program_change() from public, anon, authenticated;

create or replace function public.dispatch_due_floor_live_reminders(batch_limit integer default 500)
returns table(dispatched integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_count integer := 0;
begin
  with due as (
    select
      registration.program_id,
      registration.user_id,
      registration.reminder_minutes,
      program.starts_at,
      program.title
    from public.floor_live_registrations registration
    join public.floor_live_programs program on program.id = registration.program_id
    where program.status = 'scheduled'
      and registration.reminder_minutes > 0
      and now() >= program.starts_at - make_interval(mins => registration.reminder_minutes)
      and now() < program.starts_at
    order by program.starts_at
    limit greatest(1, least(coalesce(batch_limit, 500), 2000))
  ), claimed as (
    insert into public.floor_live_reminder_deliveries (
      program_id, user_id, reminder_minutes, scheduled_for
    )
    select program_id, user_id, reminder_minutes, starts_at from due
    on conflict do nothing
    returning program_id, user_id, reminder_minutes, scheduled_for
  ), inserted as (
    insert into public.notifications (user_id, actor_id, type, target_type, target_id, message)
    select
      claimed.user_id,
      null,
      'floor_live_reminder',
      'floor_live_program',
      claimed.program_id,
      due.title || ' starts ' ||
        case
          when claimed.reminder_minutes >= 1440 then 'tomorrow'
          when claimed.reminder_minutes = 60 then 'in 1 hour'
          else 'in ' || claimed.reminder_minutes || ' minutes'
        end || '.'
    from claimed
    join due using (program_id, user_id, reminder_minutes)
    returning id
  )
  select count(*) into delivery_count from inserted;

  return query select delivery_count;
end;
$$;

revoke all on function public.dispatch_due_floor_live_reminders(integer) from public, anon, authenticated;
grant execute on function public.dispatch_due_floor_live_reminders(integer) to service_role;

-- Schedule inside Supabase rather than Vercel. Vercel Hobby only permits
-- daily cron expressions, while live reminders require minute-level timing.
select cron.schedule(
  'floor-live-reminders',
  '*/5 * * * *',
  $command$select public.dispatch_due_floor_live_reminders(500);$command$
);

notify pgrst, 'reload schema';
commit;
