-- floor_theses: member thesis card.
--
-- Split out from 20260803110000_create_the_floor_schema.sql so it runs
-- BEFORE 20260801030000_floor_thesis_lifecycle.sql and
-- 20260801040000_restore_legacy_floor_theses.sql, both of which ALTER this
-- table. Those two files predate 20260803110000 by two days but assumed
-- floor_theses already existed -- on a fresh `supabase db reset` (empty DB,
-- migrations replayed in filename order) they failed with
-- "relation floor_theses does not exist" because the only CREATE TABLE for
-- it lived in the Aug-3 file. This creates the base shape early; the
-- lifecycle columns (lifecycle_status, withdrawn_at) are added by
-- 20260801030000 immediately after, exactly as they were on the live table.

begin;

create table if not exists public.floor_theses (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  ticker text not null,
  stance text not null,
  conviction smallint not null,
  horizon text not null,
  entry_zone_low numeric(18, 6),
  entry_zone_high numeric(18, 6),
  exit_plan text not null,
  thesis text not null,
  catalysts text not null default '',
  risks text not null default '',
  status text not null default 'open',
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floor_theses_ticker_length_check check (char_length(ticker) between 1 and 16),
  constraint floor_theses_stance_check check (stance in ('long', 'short', 'neutral')),
  constraint floor_theses_conviction_check check (conviction between 1 and 5),
  constraint floor_theses_horizon_check check (
    horizon in ('days', 'weeks', 'months', 'quarters', 'years')
  ),
  constraint floor_theses_entry_zone_order_check check (
    entry_zone_low is null or entry_zone_high is null or entry_zone_high >= entry_zone_low
  ),
  constraint floor_theses_exit_plan_length_check check (char_length(exit_plan) >= 1),
  constraint floor_theses_thesis_length_check check (char_length(thesis) >= 1),
  constraint floor_theses_status_check check (status in ('open', 'closed'))
);

comment on table public.floor_theses is
  'The Floor: member-authored investing thesis cards. Never a house rating -- always attributed to a member.';

commit;
