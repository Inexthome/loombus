-- Loombus AI usage cost tracking
-- Adds optional token and estimated-cost metadata to AI usage events.
-- Required for the Admin AI cost dashboard.
--
-- Supabase Data API policy:
-- This file explicitly preserves Data API grants/revokes for ai_usage_events.
-- Normal clients may SELECT only through RLS. Writes remain service-role/API controlled.

alter table public.ai_usage_events
  add column if not exists prompt_tokens integer,
  add column if not exists completion_tokens integer,
  add column if not exists total_tokens integer,
  add column if not exists estimated_cost_usd numeric(12,8);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_usage_events_prompt_tokens_nonnegative'
  ) then
    alter table public.ai_usage_events
      add constraint ai_usage_events_prompt_tokens_nonnegative
      check (prompt_tokens is null or prompt_tokens >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_usage_events_completion_tokens_nonnegative'
  ) then
    alter table public.ai_usage_events
      add constraint ai_usage_events_completion_tokens_nonnegative
      check (completion_tokens is null or completion_tokens >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_usage_events_total_tokens_nonnegative'
  ) then
    alter table public.ai_usage_events
      add constraint ai_usage_events_total_tokens_nonnegative
      check (total_tokens is null or total_tokens >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_usage_events_estimated_cost_usd_nonnegative'
  ) then
    alter table public.ai_usage_events
      add constraint ai_usage_events_estimated_cost_usd_nonnegative
      check (estimated_cost_usd is null or estimated_cost_usd >= 0);
  end if;
end $$;

create index if not exists ai_usage_events_provider_model_idx
on public.ai_usage_events(provider, model_name);

create index if not exists ai_usage_events_estimated_cost_usd_idx
on public.ai_usage_events(estimated_cost_usd);

alter table public.ai_usage_events enable row level security;

-- Explicit Supabase Data API grants/revokes.
-- Keep usage events private from anonymous users.
revoke all on table public.ai_usage_events from anon;

-- Authenticated users can read only rows allowed by RLS.
-- Client-side inserts/updates/deletes remain blocked.
revoke insert, update, delete on table public.ai_usage_events from authenticated;
grant select on table public.ai_usage_events to authenticated;

comment on column public.ai_usage_events.prompt_tokens is
'Prompt/input tokens reported by the AI provider, when available.';

comment on column public.ai_usage_events.completion_tokens is
'Completion/output tokens reported by the AI provider, when available.';

comment on column public.ai_usage_events.total_tokens is
'Total tokens reported by the AI provider, when available.';

comment on column public.ai_usage_events.estimated_cost_usd is
'Estimated USD cost for this AI event based on provider/model pricing at logging time.';

-- Verification helper:
-- select column_name, data_type, numeric_precision, numeric_scale, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'ai_usage_events'
--   and column_name in (
--     'prompt_tokens',
--     'completion_tokens',
--     'total_tokens',
--     'estimated_cost_usd'
--   )
-- order by ordinal_position;
