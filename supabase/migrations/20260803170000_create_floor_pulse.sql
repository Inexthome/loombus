-- The Floor Pulse: a compact, member-only activity layer above discussions.
-- Events never impersonate member discussion. Members deliberately turn an
-- event into one discussion, and the event then links everyone to that thread.

begin;

create table if not exists public.floor_pulse_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in ('research', 'thesis', 'outcome', 'live', 'academy', 'announcement')
  ),
  source_type text not null,
  source_id uuid not null default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 180),
  summary text not null default '' check (char_length(summary) <= 500),
  href text not null check (href like '/the-floor%'),
  actor_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floor_pulse_source_unique unique (source_type, source_id)
);

create index if not exists floor_pulse_events_feed_idx
  on public.floor_pulse_events (occurred_at desc);
create index if not exists floor_pulse_events_active_idx
  on public.floor_pulse_events (expires_at, occurred_at desc);

create table if not exists public.floor_pulse_event_reads (
  event_id uuid not null references public.floor_pulse_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.floor_posts
  add column if not exists pulse_event_id uuid
    references public.floor_pulse_events(id) on delete set null;

create unique index if not exists floor_posts_pulse_event_unique_idx
  on public.floor_posts (pulse_event_id)
  where pulse_event_id is not null;

alter table public.floor_pulse_events enable row level security;
alter table public.floor_pulse_event_reads enable row level security;

drop policy if exists "Floor members read pulse events" on public.floor_pulse_events;
create policy "Floor members read pulse events"
on public.floor_pulse_events for select to authenticated
using (
  exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_admin
  )
  or exists (
    select 1 from public.floor_subscriptions subscription
    where subscription.user_id = auth.uid()
      and subscription.status in ('active', 'trialing')
  )
);

drop policy if exists "Floor members manage their pulse reads" on public.floor_pulse_event_reads;
create policy "Floor members manage their pulse reads"
on public.floor_pulse_event_reads for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.floor_pulse_events event
    where event.id = event_id
  )
);

revoke all on table public.floor_pulse_events from public, anon, authenticated;
grant select on table public.floor_pulse_events to authenticated;
grant all on table public.floor_pulse_events to service_role;

revoke all on table public.floor_pulse_event_reads from public, anon, authenticated;
grant select, insert, update, delete on table public.floor_pulse_event_reads to authenticated;
grant all on table public.floor_pulse_event_reads to service_role;

create or replace function public.upsert_floor_pulse_event(
  pulse_event_type text,
  pulse_source_type text,
  pulse_source_id uuid,
  pulse_title text,
  pulse_summary text,
  pulse_href text,
  pulse_actor_id uuid,
  pulse_occurred_at timestamptz,
  pulse_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.floor_pulse_events (
    event_type,
    source_type,
    source_id,
    title,
    summary,
    href,
    actor_id,
    occurred_at,
    expires_at
  )
  values (
    pulse_event_type,
    pulse_source_type,
    pulse_source_id,
    left(btrim(pulse_title), 180),
    left(coalesce(btrim(pulse_summary), ''), 500),
    pulse_href,
    pulse_actor_id,
    coalesce(pulse_occurred_at, now()),
    pulse_expires_at
  )
  on conflict (source_type, source_id) do update
  set event_type = excluded.event_type,
      title = excluded.title,
      summary = excluded.summary,
      href = excluded.href,
      actor_id = excluded.actor_id,
      occurred_at = excluded.occurred_at,
      expires_at = excluded.expires_at,
      updated_at = now();
end;
$$;

revoke all on function public.upsert_floor_pulse_event(
  text, text, uuid, text, text, text, uuid, timestamptz, timestamptz
) from public, anon, authenticated;

create or replace function public.capture_floor_research_pulse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
    and (tg_op = 'INSERT' or old.status is distinct from 'published')
  then
    perform public.upsert_floor_pulse_event(
      'research',
      'floor_research_publication',
      new.id,
      'New research: ' || new.title,
      new.excerpt,
      '/the-floor/research-desk#publication-' || new.id::text,
      new.reviewer_id,
      coalesce(new.published_at, now()),
      coalesce(new.published_at, now()) + interval '14 days'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists capture_floor_research_pulse_trigger
  on public.floor_research_publications;
create trigger capture_floor_research_pulse_trigger
after insert or update of status on public.floor_research_publications
for each row execute function public.capture_floor_research_pulse();

create or replace function public.capture_floor_thesis_pulse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_floor_pulse_event(
    'thesis',
    'floor_thesis',
    new.id,
    'New thesis: ' || upper(new.ticker) || ' ' || initcap(new.stance) || ' case',
    new.thesis,
    '/the-floor/company/' || upper(new.ticker),
    new.author_id,
    new.created_at,
    new.created_at + interval '7 days'
  );
  return new;
end;
$$;

drop trigger if exists capture_floor_thesis_pulse_trigger on public.floor_theses;
create trigger capture_floor_thesis_pulse_trigger
after insert on public.floor_theses
for each row execute function public.capture_floor_thesis_pulse();

create or replace function public.capture_floor_call_outcome_pulse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    perform public.upsert_floor_pulse_event(
      'outcome',
      'floor_call',
      new.id,
      upper(new.ticker) || ' call resolved: ' || initcap(new.outcome),
      new.prediction,
      '/the-floor/company/' || upper(new.ticker),
      new.resolved_by,
      coalesce(new.resolved_at, now()),
      coalesce(new.resolved_at, now()) + interval '14 days'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists capture_floor_call_outcome_pulse_trigger on public.floor_calls;
create trigger capture_floor_call_outcome_pulse_trigger
after update of status on public.floor_calls
for each row execute function public.capture_floor_call_outcome_pulse();

create or replace function public.capture_floor_live_program_pulse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pulse_label text;
begin
  if new.status not in ('scheduled', 'live', 'completed') then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = new.status and old.starts_at = new.starts_at
    and old.title = new.title and old.description = new.description
  then
    return new;
  end if;

  pulse_label := case new.status
    when 'live' then 'Live now: '
    when 'completed' then 'Replay available: '
    else 'Upcoming on The Floor: '
  end;

  perform public.upsert_floor_pulse_event(
    'live',
    'floor_live_program',
    new.id,
    pulse_label || new.title,
    coalesce(nullif(new.description, ''), new.focus),
    '/the-floor/live#program-' || new.id::text,
    new.host_id,
    case when new.status = 'scheduled' then new.created_at else now() end,
    greatest(new.starts_at + interval '2 days', now() + interval '1 day')
  );
  return new;
end;
$$;

drop trigger if exists capture_floor_live_program_pulse_trigger
  on public.floor_live_programs;
create trigger capture_floor_live_program_pulse_trigger
after insert or update of status, starts_at, title, description
on public.floor_live_programs
for each row execute function public.capture_floor_live_program_pulse();

-- Backfill only current activity. Older history stays on its original surface
-- and does not crowd a member's first Pulse visit.
insert into public.floor_pulse_events (
  event_type, source_type, source_id, title, summary, href, actor_id, occurred_at, expires_at
)
select
  'research',
  'floor_research_publication',
  publication.id,
  'New research: ' || publication.title,
  left(publication.excerpt, 500),
  '/the-floor/research-desk#publication-' || publication.id::text,
  publication.reviewer_id,
  publication.published_at,
  publication.published_at + interval '14 days'
from public.floor_research_publications publication
where publication.status = 'published'
  and publication.published_at >= now() - interval '14 days'
on conflict (source_type, source_id) do nothing;

insert into public.floor_pulse_events (
  event_type, source_type, source_id, title, summary, href, actor_id, occurred_at, expires_at
)
select
  'thesis',
  'floor_thesis',
  thesis.id,
  'New thesis: ' || upper(thesis.ticker) || ' ' || initcap(thesis.stance) || ' case',
  left(thesis.thesis, 500),
  '/the-floor/company/' || upper(thesis.ticker),
  thesis.author_id,
  thesis.created_at,
  thesis.created_at + interval '7 days'
from public.floor_theses thesis
where thesis.created_at >= now() - interval '7 days'
  and thesis.lifecycle_status = 'active'
on conflict (source_type, source_id) do nothing;

insert into public.floor_pulse_events (
  event_type, source_type, source_id, title, summary, href, actor_id, occurred_at, expires_at
)
select
  'outcome',
  'floor_call',
  call.id,
  upper(call.ticker) || ' call resolved: ' || initcap(call.outcome),
  left(call.prediction, 500),
  '/the-floor/company/' || upper(call.ticker),
  call.resolved_by,
  call.resolved_at,
  call.resolved_at + interval '14 days'
from public.floor_calls call
where call.status = 'resolved'
  and call.resolved_at >= now() - interval '14 days'
on conflict (source_type, source_id) do nothing;

insert into public.floor_pulse_events (
  event_type, source_type, source_id, title, summary, href, actor_id, occurred_at, expires_at
)
select
  'live',
  'floor_live_program',
  program.id,
  case program.status
    when 'live' then 'Live now: '
    when 'completed' then 'Replay available: '
    else 'Upcoming on The Floor: '
  end || program.title,
  left(coalesce(nullif(program.description, ''), program.focus), 500),
  '/the-floor/live#program-' || program.id::text,
  program.host_id,
  case when program.status = 'scheduled' then program.created_at else program.updated_at end,
  greatest(program.starts_at + interval '2 days', now() + interval '1 day')
from public.floor_live_programs program
where program.status in ('scheduled', 'live', 'completed')
  and program.starts_at >= now() - interval '2 days'
on conflict (source_type, source_id) do nothing;

alter table public.floor_pulse_events replica identity full;
alter table public.floor_pulse_event_reads replica identity full;

do $$
declare
  pulse_table text;
begin
  foreach pulse_table in array array['floor_pulse_events', 'floor_pulse_event_reads']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = pulse_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', pulse_table);
    end if;
  end loop;
end;
$$;

comment on table public.floor_pulse_events is
  'Compact real Floor activity. Events inform discussions but never impersonate member posts.';
comment on column public.floor_posts.pulse_event_id is
  'Optional source Pulse event. Unique so one activity item produces at most one discussion thread.';

notify pgrst, 'reload schema';

commit;
