-- Loombus Phase 3.2: AI Related Ideas feature key setup
-- Adds related_ideas while preserving existing allowed AI output keys.
-- This is the foundation for idea graph / related idea discovery.

alter table public.discussion_ai_outputs
  drop constraint if exists discussion_ai_outputs_feature_key_check;

alter table public.discussion_ai_outputs
  add constraint discussion_ai_outputs_feature_key_check
  check (
    feature_key in (
      'key_takeaways',
      'what_changed',
      'disagreement_map',
      'research_summary',
      'writing_assist',
      'moderation_assist',
      'conversation_map',
      'related_ideas'
    )
  );

alter table public.ai_output_ratings
  drop constraint if exists ai_output_ratings_feature_key_check;

alter table public.ai_output_ratings
  add constraint ai_output_ratings_feature_key_check
  check (
    feature_key in (
      'thread_summary',
      'key_takeaways',
      'what_changed',
      'disagreement_map',
      'conversation_map',
      'related_ideas'
    )
  );

alter table public.discussion_ai_outputs enable row level security;
alter table public.ai_output_ratings enable row level security;

revoke all on table public.discussion_ai_outputs from anon;
revoke insert, update, delete on table public.discussion_ai_outputs from authenticated;
grant select on table public.discussion_ai_outputs to authenticated;

revoke all on table public.ai_output_ratings from anon;
grant select, insert, update, delete on table public.ai_output_ratings to authenticated;

comment on constraint discussion_ai_outputs_feature_key_check on public.discussion_ai_outputs is
'Allowed cached AI discussion output feature keys, including Phase 3 related_ideas.';

comment on constraint ai_output_ratings_feature_key_check on public.ai_output_ratings is
'Allowed AI output rating feature keys, including Phase 3 related_ideas.';
