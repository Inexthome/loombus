create table if not exists public.loombus_v2_create_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  topic text not null default '',
  body text not null default '',
  tags text not null default '',
  mode text not null default 'open_discussion',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loombus_v2_create_drafts_user_unique unique (user_id),
  constraint loombus_v2_create_drafts_mode_check check (
    mode in ('open_discussion', 'debate', 'research_question', 'problem_solving')
  )
);

alter table public.loombus_v2_create_drafts enable row level security;

create policy "Users can read their own V2 create draft"
  on public.loombus_v2_create_drafts
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own V2 create draft"
  on public.loombus_v2_create_drafts
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own V2 create draft"
  on public.loombus_v2_create_drafts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own V2 create draft"
  on public.loombus_v2_create_drafts
  for delete
  using (auth.uid() = user_id);

create index if not exists loombus_v2_create_drafts_user_updated_idx
  on public.loombus_v2_create_drafts (user_id, updated_at desc);

create or replace function public.set_loombus_v2_create_draft_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_loombus_v2_create_draft_updated_at
  on public.loombus_v2_create_drafts;

create trigger set_loombus_v2_create_draft_updated_at
  before update on public.loombus_v2_create_drafts
  for each row
  execute function public.set_loombus_v2_create_draft_updated_at();
