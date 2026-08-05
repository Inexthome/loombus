-- The Floor: accountable-reasoning investing space.
--
-- Non-negotiable: the house never issues buy/sell ratings. This schema scores
-- argument QUALITY (floor_thesis_analyses: steelman / redteam / blind spots)
-- and member TRACK RECORD (floor_member_credibility, derived from resolved
-- floor_calls) -- never a recommendation. floor_thesis_analyses structurally
-- has no rating/recommendation column, so the house cannot store one.
--
-- floor_calls are insert-your-own, never updatable by members, and once a
-- call leaves 'pending' (resolved or void) it is locked forever -- even for
-- service_role -- by enforce_floor_call_resolution_integrity(). That, plus
-- floor_member_credibility being a plain (non-materialized) view computed
-- live from floor_calls, is what keeps the scoreboard trustworthy.
--
-- The Floor is platform-wide (not Room-scoped): any authenticated, adult,
-- non-suspended member can read and post. Minors are excluded from posting
-- and from the credibility/track-record surface via floor_member_is_eligible().

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- floor_theses: member thesis card. Base table created in
-- 20260801020000_create_floor_theses.sql (which runs first so the
-- lifecycle-column ALTERs in 20260801030000 and 20260801040000 have
-- something to alter); lifecycle_status and withdrawn_at were added there.
-- Indexes for it live here since they only need the columns, not creation
-- order.
-- ---------------------------------------------------------------------------

create index if not exists floor_theses_author_created_idx
  on public.floor_theses (author_id, created_at desc);
create index if not exists floor_theses_ticker_created_idx
  on public.floor_theses (ticker, created_at desc);
create index if not exists floor_theses_live_feed_idx
  on public.floor_theses (created_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- floor_thesis_analyses: AI red-team -- steelman / redteam / blind spots.
-- No rating or recommendation column exists, by design.
-- ---------------------------------------------------------------------------

create table if not exists public.floor_thesis_analyses (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references public.floor_theses(id) on delete cascade,
  steelman text not null,
  redteam text not null,
  blind_spots text not null,
  model text,
  created_at timestamptz not null default now(),
  constraint floor_thesis_analyses_steelman_length_check check (char_length(steelman) >= 1),
  constraint floor_thesis_analyses_redteam_length_check check (char_length(redteam) >= 1),
  constraint floor_thesis_analyses_blind_spots_length_check check (char_length(blind_spots) >= 1)
);

create index if not exists floor_thesis_analyses_thesis_created_idx
  on public.floor_thesis_analyses (thesis_id, created_at desc);

-- ---------------------------------------------------------------------------
-- floor_calls: falsifiable scored predictions. Insert-your-own only; no
-- update/delete for members. Only a service-role resolver stamps outcomes,
-- and only once -- see enforce_floor_call_resolution_integrity().
-- ---------------------------------------------------------------------------

create table if not exists public.floor_calls (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references public.floor_theses(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  ticker text not null,
  prediction text not null,
  comparator text not null,
  target_value numeric(18, 6),
  target_value_high numeric(18, 6),
  resolves_by timestamptz not null,
  status text not null default 'pending',
  outcome text,
  outcome_note text,
  resolved_value numeric(18, 6),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floor_calls_ticker_length_check check (char_length(ticker) between 1 and 16),
  constraint floor_calls_prediction_length_check check (char_length(prediction) >= 1),
  constraint floor_calls_comparator_check check (
    comparator in ('gte', 'lte', 'eq', 'range')
  ),
  constraint floor_calls_target_shape_check check (
    (comparator in ('gte', 'lte', 'eq') and target_value is not null and target_value_high is null)
    or
    (comparator = 'range' and target_value is not null and target_value_high is not null
      and target_value_high > target_value)
  ),
  constraint floor_calls_status_check check (status in ('pending', 'resolved', 'void')),
  constraint floor_calls_outcome_check check (
    outcome is null or outcome in ('correct', 'incorrect', 'partial')
  ),
  constraint floor_calls_resolution_shape_check check (
    (status = 'pending' and outcome is null and resolved_at is null and resolved_by is null)
    or
    (status = 'void' and outcome is null)
    or
    (status = 'resolved' and outcome is not null and resolved_at is not null and resolved_by is not null)
  )
);

create index if not exists floor_calls_thesis_idx
  on public.floor_calls (thesis_id);
create index if not exists floor_calls_author_created_idx
  on public.floor_calls (author_id, created_at desc);
create index if not exists floor_calls_ticker_created_idx
  on public.floor_calls (ticker, created_at desc);
create index if not exists floor_calls_pending_due_idx
  on public.floor_calls (resolves_by)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- weekly_digests: "The Weave". Service-authored; members read published only.
-- ---------------------------------------------------------------------------

create table if not exists public.weekly_digests (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  title text not null default 'The Weave',
  summary text not null,
  highlighted_thesis_ids uuid[] not null default '{}',
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_digests_week_order_check check (week_end >= week_start),
  constraint weekly_digests_summary_length_check check (char_length(summary) >= 1)
);

create unique index if not exists weekly_digests_week_start_unique_idx
  on public.weekly_digests (week_start);
create index if not exists weekly_digests_published_idx
  on public.weekly_digests (published_at desc)
  where published_at is not null;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.enforce_floor_thesis_structural_lock()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    new.updated_at = now();
    return new;
  end if;

  if new.author_id is distinct from old.author_id
     or new.ticker is distinct from old.ticker
     or new.stance is distinct from old.stance
     or new.conviction is distinct from old.conviction
     or new.horizon is distinct from old.horizon
     or new.entry_zone_low is distinct from old.entry_zone_low
     or new.entry_zone_high is distinct from old.entry_zone_high
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Core thesis terms cannot be edited after posting. Withdraw and post a new thesis instead.'
      using errcode = '42501';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists enforce_floor_thesis_structural_lock_trigger on public.floor_theses;
create trigger enforce_floor_thesis_structural_lock_trigger
before update on public.floor_theses
for each row execute function public.enforce_floor_thesis_structural_lock();

create or replace function public.enforce_floor_call_resolution_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.status <> 'pending' then
    raise exception 'floor_calls cannot be modified once resolved or voided.'
      using errcode = '42501';
  end if;

  if new.thesis_id is distinct from old.thesis_id
     or new.author_id is distinct from old.author_id
     or new.ticker is distinct from old.ticker
     or new.prediction is distinct from old.prediction
     or new.comparator is distinct from old.comparator
     or new.target_value is distinct from old.target_value
     or new.target_value_high is distinct from old.target_value_high
     or new.resolves_by is distinct from old.resolves_by
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Original floor_calls terms are immutable.'
      using errcode = '42501';
  end if;

  if new.status in ('resolved', 'void') and new.resolved_at is null then
    new.resolved_at = now();
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists enforce_floor_call_resolution_integrity_trigger on public.floor_calls;
create trigger enforce_floor_call_resolution_integrity_trigger
before update on public.floor_calls
for each row execute function public.enforce_floor_call_resolution_integrity();

create or replace function public.touch_floor_updated_at()
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

drop trigger if exists touch_weekly_digests_updated_at on public.weekly_digests;
create trigger touch_weekly_digests_updated_at
before update on public.weekly_digests
for each row execute function public.touch_floor_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions (RLS)
-- ---------------------------------------------------------------------------

create or replace function public.floor_member_is_eligible()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    left join public.profile_sensitive ps on ps.id = p.id
    where p.id = auth.uid()
      and coalesce(ps.age_band, 'unknown') = 'adult'
      and coalesce(p.account_status, 'active') not in ('suspended', 'banned', 'deleted')
  );
$$;

create or replace function public.floor_thesis_is_visible(target_thesis_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.floor_theses t
    where t.id = target_thesis_id
      and (
        t.deleted_at is null
        or t.author_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.is_admin
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.floor_theses enable row level security;
alter table public.floor_thesis_analyses enable row level security;
alter table public.floor_calls enable row level security;
alter table public.weekly_digests enable row level security;

drop policy if exists "Floor theses are visible to eligible members" on public.floor_theses;
create policy "Floor theses are visible to eligible members"
on public.floor_theses for select to authenticated
using (
  deleted_at is null
  or author_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

drop policy if exists "Eligible members can post their own thesis" on public.floor_theses;
create policy "Eligible members can post their own thesis"
on public.floor_theses for insert to authenticated
with check (
  author_id = auth.uid()
  and public.floor_member_is_eligible()
  and deleted_at is null
  and deleted_by is null
  and status = 'open'
);

drop policy if exists "Thesis authors can edit their open thesis" on public.floor_theses;
create policy "Thesis authors can edit their open thesis"
on public.floor_theses for update to authenticated
using (author_id = auth.uid() and deleted_at is null)
with check (
  author_id = auth.uid()
  and (deleted_by is null or deleted_by = auth.uid())
);

drop policy if exists "Floor thesis analyses are visible with their thesis" on public.floor_thesis_analyses;
create policy "Floor thesis analyses are visible with their thesis"
on public.floor_thesis_analyses for select to authenticated
using (public.floor_thesis_is_visible(thesis_id));

drop policy if exists "Floor calls are publicly visible for the scoreboard" on public.floor_calls;
create policy "Floor calls are publicly visible for the scoreboard"
on public.floor_calls for select to authenticated
using (true);

drop policy if exists "Eligible members can post their own falsifiable call" on public.floor_calls;
create policy "Eligible members can post their own falsifiable call"
on public.floor_calls for insert to authenticated
with check (
  author_id = auth.uid()
  and public.floor_member_is_eligible()
  and status = 'pending'
  and outcome is null
  and resolved_value is null
  and resolved_at is null
  and resolved_by is null
  and resolves_by > now()
  and exists (
    select 1 from public.floor_theses t
    where t.id = thesis_id
      and t.author_id = auth.uid()
      and t.deleted_at is null
  )
);

drop policy if exists "Weekly digests are visible once published" on public.weekly_digests;
create policy "Weekly digests are visible once published"
on public.weekly_digests for select to authenticated
using (published_at is not null);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on table public.floor_theses from anon;
revoke all on table public.floor_thesis_analyses from anon;
revoke all on table public.floor_calls from anon;
revoke all on table public.weekly_digests from anon;

revoke insert, update, delete on table public.floor_theses from authenticated;
grant select, insert, update on table public.floor_theses to authenticated;

revoke insert, update, delete on table public.floor_thesis_analyses from authenticated;
grant select on table public.floor_thesis_analyses to authenticated;
grant select, insert on table public.floor_thesis_analyses to service_role;

revoke insert, update, delete on table public.floor_calls from authenticated;
grant select, insert on table public.floor_calls to authenticated;
grant select, insert, update on table public.floor_calls to service_role;

revoke insert, update, delete on table public.weekly_digests from authenticated;
grant select on table public.weekly_digests to authenticated;
grant select, insert, update, delete on table public.weekly_digests to service_role;

-- ---------------------------------------------------------------------------
-- floor_member_credibility: derived live from resolved floor_calls, never a
-- stored number. security_invoker keeps the caller's own RLS in effect.
-- ---------------------------------------------------------------------------

create or replace view public.floor_member_credibility
with (security_invoker = true) as
select
  p.id as member_id,
  p.username,
  p.full_name,
  count(c.id) filter (where c.status = 'pending') as pending_calls,
  count(c.id) filter (where c.status = 'resolved') as resolved_calls,
  count(c.id) filter (where c.outcome = 'correct') as correct_calls,
  count(c.id) filter (where c.outcome = 'incorrect') as incorrect_calls,
  count(c.id) filter (where c.outcome = 'partial') as partial_calls,
  case
    when count(c.id) filter (where c.status = 'resolved' and c.outcome in ('correct', 'incorrect')) > 0
      then round(
        100.0 * count(c.id) filter (where c.outcome = 'correct')
          / count(c.id) filter (where c.status = 'resolved' and c.outcome in ('correct', 'incorrect')),
        1
      )
    else null
  end as accuracy_pct,
  max(c.resolved_at) as last_resolved_at
from public.profiles p
join public.floor_calls c on c.author_id = p.id
group by p.id, p.username, p.full_name;

revoke all on public.floor_member_credibility from anon;
grant select on public.floor_member_credibility to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.floor_theses replica identity full;
alter table public.floor_thesis_analyses replica identity full;
alter table public.floor_calls replica identity full;
alter table public.weekly_digests replica identity full;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'floor_theses',
    'floor_thesis_analyses',
    'floor_calls',
    'weekly_digests'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        relation_name
      );
    end if;
  end loop;
end;
$$;

comment on table public.floor_theses is
  'The Floor: member-authored investing thesis cards. Never a house rating -- always attributed to a member.';
comment on table public.floor_thesis_analyses is
  'AI red-team of a Floor thesis: steelman, redteam, blind spots. No rating or recommendation column exists, by design.';
comment on table public.floor_calls is
  'Falsifiable scored predictions tied to a Floor thesis. Insert-your-own only; immutable once resolved or voided by the service-role resolver.';
comment on table public.weekly_digests is
  'The Weave: service-authored weekly digest of Floor activity. Visible to members once published.';
comment on view public.floor_member_credibility is
  'Member track record derived live from resolved floor_calls. Never stored -- always computed.';

notify pgrst, 'reload schema';

commit;
