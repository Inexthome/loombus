-- Discussion Drafts setup for Loombus
-- Purpose:
-- - Keep drafts separate from published discussions.
-- - Prevent drafts from appearing in public discussion feeds.
-- - Gate draft creation/update/delete to Premium/Admin users.
-- - Let users read only their own drafts.

create table if not exists public.discussion_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  topic text not null default 'General',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discussion_drafts_title_length
    check (char_length(title) <= 160),
  constraint discussion_drafts_topic_length
    check (char_length(topic) between 1 and 80),
  constraint discussion_drafts_body_length
    check (char_length(body) <= 12000)
);

create index if not exists discussion_drafts_user_updated_idx
  on public.discussion_drafts (user_id, updated_at desc);

create or replace function public.user_has_discussion_draft_access(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_ai_entitlements entitlement
    where entitlement.user_id = target_user_id
      and entitlement.ai_assisted_enabled = true
      and entitlement.tier in ('premium', 'admin')
  );
$$;

create or replace function public.set_discussion_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_discussion_drafts_updated_at
  on public.discussion_drafts;

create trigger set_discussion_drafts_updated_at
before update on public.discussion_drafts
for each row
execute function public.set_discussion_drafts_updated_at();

alter table public.discussion_drafts enable row level security;

drop policy if exists "Users can read their discussion drafts"
  on public.discussion_drafts;

create policy "Users can read their discussion drafts"
on public.discussion_drafts
for select
using (auth.uid() = user_id);

drop policy if exists "Premium users can create discussion drafts"
  on public.discussion_drafts;

create policy "Premium users can create discussion drafts"
on public.discussion_drafts
for insert
with check (
  auth.uid() = user_id
  and public.user_has_discussion_draft_access(user_id)
);

drop policy if exists "Premium users can update discussion drafts"
  on public.discussion_drafts;

create policy "Premium users can update discussion drafts"
on public.discussion_drafts
for update
using (
  auth.uid() = user_id
  and public.user_has_discussion_draft_access(user_id)
)
with check (
  auth.uid() = user_id
  and public.user_has_discussion_draft_access(user_id)
);

drop policy if exists "Premium users can delete discussion drafts"
  on public.discussion_drafts;

create policy "Premium users can delete discussion drafts"
on public.discussion_drafts
for delete
using (
  auth.uid() = user_id
  and public.user_has_discussion_draft_access(user_id)
);
