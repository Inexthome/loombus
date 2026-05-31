-- Loombus Phase 2: Reality Lens
-- Adds an optional human-reality classification beside the primary topic lane.
-- This keeps existing discussion topics untouched while allowing structured
-- human-condition signals such as loneliness, hidden stress, meaning, and life transitions.

alter table public.discussions
  add column if not exists reality_lens text null;

alter table public.discussions
  drop constraint if exists discussions_reality_lens_check;

alter table public.discussions
  add constraint discussions_reality_lens_check
  check (
    reality_lens is null
    or reality_lens in (
      'Loneliness',
      'Hidden Financial Stress',
      'Fear of Irrelevance',
      'Psychological Exhaustion',
      'Quiet Regret',
      'Rebuilding Meaning',
      'Entrepreneur Isolation',
      'Reality Behind Success',
      'AI and Human Purpose',
      'Life Transition'
    )
  );

create index if not exists discussions_reality_lens_created_at_idx
on public.discussions (reality_lens, created_at desc)
where reality_lens is not null;

comment on column public.discussions.reality_lens is
'Optional Phase 2 human-reality lens for discussions, separate from the primary topic lane.';
