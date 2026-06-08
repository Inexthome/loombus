alter table public.discussions
  add column if not exists discussion_type text not null default 'open_discussion',
  add column if not exists discussion_metadata jsonb not null default '{}'::jsonb;

alter table public.discussions
  drop constraint if exists discussions_discussion_type_check;

alter table public.discussions
  add constraint discussions_discussion_type_check
  check (
    discussion_type in (
      'open_discussion',
      'debate',
      'research_question',
      'problem_solving'
    )
  );

comment on column public.discussions.discussion_type is
  'Structured discussion mode: open_discussion, debate, research_question, or problem_solving.';

comment on column public.discussions.discussion_metadata is
  'Flexible structured fields for discussion modes, stored as JSON.';
