-- Fix /v2/saved folder creation.
-- Error seen in production: RLS rejected inserts on public.bookmark_collections.
-- Apply in Supabase SQL Editor.

alter table public.bookmark_collections enable row level security;

grant select, insert on public.bookmark_collections to authenticated;

create policy "bookmark_collections_insert_own"
  on public.bookmark_collections
  for insert
  to authenticated
  with check (user_id = auth.uid());
