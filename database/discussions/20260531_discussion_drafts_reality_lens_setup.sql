-- Loombus Phase 2: Reality Lens draft support
-- Keeps optional Reality Lens values when Premium/Admin members save discussion drafts.

alter table public.discussion_drafts
  add column if not exists reality_lens text null;

alter table public.discussion_drafts
  drop constraint if exists discussion_drafts_reality_lens_check;

alter table public.discussion_drafts
  add constraint discussion_drafts_reality_lens_check
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

comment on column public.discussion_drafts.reality_lens is
'Optional Phase 2 human-reality lens saved with discussion drafts.';
