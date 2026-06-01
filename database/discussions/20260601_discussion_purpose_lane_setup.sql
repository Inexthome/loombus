-- Loombus Phase 5.1: Purpose Lanes
-- Adds optional purpose direction to discussions.
-- This is not therapy, diagnosis, life coaching, scoring, or ranking.

alter table public.discussions
  add column if not exists purpose_lane text null;

alter table public.discussions
  drop constraint if exists discussions_purpose_lane_check;

alter table public.discussions
  add constraint discussions_purpose_lane_check
  check (
    purpose_lane is null
    or purpose_lane in (
      'Learning',
      'Mastery',
      'Contribution',
      'Community',
      'Career transition',
      'Human development',
      'Local problem-solving',
      'Life after automation'
    )
  );

create index if not exists discussions_purpose_lane_created_at_idx
on public.discussions (purpose_lane, created_at desc)
where purpose_lane is not null;

alter table public.discussions enable row level security;

revoke all on table public.discussions from anon;
grant select on table public.discussions to anon;
grant select, insert, update on table public.discussions to authenticated;

comment on column public.discussions.purpose_lane is
'Optional discussion purpose direction. Not therapy, diagnosis, life coaching, scoring, or ranking.';
