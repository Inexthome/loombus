-- Loombus user blocking support
-- Run this in Supabase SQL Editor before deploying block/unblock UI code.

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_no_self_block check (blocker_id <> blocked_id)
);

create unique index if not exists user_blocks_unique_pair_idx
on public.user_blocks(blocker_id, blocked_id);

create index if not exists user_blocks_blocker_id_idx
on public.user_blocks(blocker_id);

create index if not exists user_blocks_blocked_id_idx
on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_blocks'
      and policyname = 'Users can read block relationships involving themselves'
  ) then
    create policy "Users can read block relationships involving themselves"
    on public.user_blocks
    for select
    using (auth.uid() = blocker_id or auth.uid() = blocked_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_blocks'
      and policyname = 'Users can create their own blocks'
  ) then
    create policy "Users can create their own blocks"
    on public.user_blocks
    for insert
    with check (auth.uid() = blocker_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_blocks'
      and policyname = 'Users can delete their own blocks'
  ) then
    create policy "Users can delete their own blocks"
    on public.user_blocks
    for delete
    using (auth.uid() = blocker_id);
  end if;
end $$;

comment on table public.user_blocks is
'User-to-user block relationships. A blocker can prevent follow interactions with a blocked profile.';
