-- Loombus reusable Premium AI output cache
-- Run this in Supabase SQL Editor before wiring AI features to cached outputs.

create table if not exists public.discussion_ai_outputs (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  feature_key text not null,
  output_text text not null,
  model_name text,
  source_reply_count integer not null default 0,
  source_content_hash text,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discussion_ai_outputs_feature_key_check
    check (
      feature_key in (
        'key_takeaways',
        'what_changed',
        'disagreement_map',
        'research_summary',
        'writing_assist',
        'moderation_assist'
      )
    )
);

create unique index if not exists discussion_ai_outputs_discussion_feature_idx
on public.discussion_ai_outputs(discussion_id, feature_key);

create index if not exists discussion_ai_outputs_discussion_id_idx
on public.discussion_ai_outputs(discussion_id);

create index if not exists discussion_ai_outputs_feature_key_idx
on public.discussion_ai_outputs(feature_key);

create index if not exists discussion_ai_outputs_generated_at_idx
on public.discussion_ai_outputs(generated_at);

alter table public.discussion_ai_outputs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discussion_ai_outputs'
      and policyname = 'Premium members and admins can read discussion AI outputs'
  ) then
    create policy "Premium members and admins can read discussion AI outputs"
    on public.discussion_ai_outputs
    for select
    using (
      exists (
        select 1
        from public.user_ai_entitlements
        where user_ai_entitlements.user_id = auth.uid()
          and user_ai_entitlements.ai_assisted_enabled = true
          and user_ai_entitlements.tier in ('premium', 'admin')
      )
      or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discussion_ai_outputs'
      and policyname = 'Premium members and admins can create discussion AI outputs'
  ) then
    create policy "Premium members and admins can create discussion AI outputs"
    on public.discussion_ai_outputs
    for insert
    with check (
      auth.uid() = generated_by
      and (
        exists (
          select 1
          from public.user_ai_entitlements
          where user_ai_entitlements.user_id = auth.uid()
            and user_ai_entitlements.ai_assisted_enabled = true
            and user_ai_entitlements.tier in ('premium', 'admin')
        )
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'discussion_ai_outputs'
      and policyname = 'Premium members and admins can update discussion AI outputs'
  ) then
    create policy "Premium members and admins can update discussion AI outputs"
    on public.discussion_ai_outputs
    for update
    using (
      exists (
        select 1
        from public.user_ai_entitlements
        where user_ai_entitlements.user_id = auth.uid()
          and user_ai_entitlements.ai_assisted_enabled = true
          and user_ai_entitlements.tier in ('premium', 'admin')
      )
      or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.is_admin = true
      )
    )
    with check (
      auth.uid() = generated_by
      and (
        exists (
          select 1
          from public.user_ai_entitlements
          where user_ai_entitlements.user_id = auth.uid()
            and user_ai_entitlements.ai_assisted_enabled = true
            and user_ai_entitlements.tier in ('premium', 'admin')
        )
        or exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.is_admin = true
        )
      )
    );
  end if;
end $$;

comment on table public.discussion_ai_outputs is
'Reusable cached outputs for Premium AI-Assisted Layer discussion features.';

comment on column public.discussion_ai_outputs.feature_key is
'AI feature key such as key_takeaways, what_changed, disagreement_map, research_summary, writing_assist, or moderation_assist.';

comment on column public.discussion_ai_outputs.source_content_hash is
'Hash of the discussion and visible reply source used to decide whether cached AI output is stale.';
