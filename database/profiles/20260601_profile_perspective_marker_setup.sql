-- Loombus Phase 4.5: Profile perspective marker
-- Adds optional self-context for where a member is speaking from.
-- This is not verification, expertise scoring, ranking, or a trust score.

alter table public.profiles
  add column if not exists perspective_marker text;

alter table public.profiles
  drop constraint if exists profiles_perspective_marker_check;

alter table public.profiles
  add constraint profiles_perspective_marker_check
  check (
    perspective_marker is null
    or perspective_marker in (
      'Lived experience',
      'Professional experience',
      'Research-based',
      'Builder / operator',
      'Student / learner',
      'Question / exploring'
    )
  );

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
grant select on table public.profiles to anon;
grant select, insert, update on table public.profiles to authenticated;

comment on column public.profiles.perspective_marker is
'Optional self-selected perspective context shown on profile. Not a verification claim, expertise score, ranking, or trust score.';
