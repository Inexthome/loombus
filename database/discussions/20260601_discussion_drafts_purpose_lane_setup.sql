-- Loombus Phase 5.1: Purpose Lane draft support
-- Keeps optional Purpose Lane values when Premium/Admin members save discussion drafts.
-- This is not therapy, diagnosis, life coaching, scoring, or ranking.

alter table public.discussion_drafts
  add column if not exists purpose_lane text null;

alter table public.discussion_drafts
  drop constraint if exists discussion_drafts_purpose_lane_check;

alter table public.discussion_drafts
  add constraint discussion_drafts_purpose_lane_check
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

alter table public.discussion_drafts enable row level security;

revoke all on table public.discussion_drafts from anon;
grant select, insert, update, delete on table public.discussion_drafts to authenticated;

comment on column public.discussion_drafts.purpose_lane is
'Optional draft purpose direction. Not therapy, diagnosis, life coaching, scoring, or ranking.';
