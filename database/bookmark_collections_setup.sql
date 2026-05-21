-- Bookmark Collections / Saved Folders setup for Loombus
-- Purpose:
-- - Keep existing bookmarks table and save/unsave behavior.
-- - Add user-owned bookmark collections/folders.
-- - Let each existing bookmark optionally belong to one collection.
-- - Enforce that a bookmark can only reference a collection owned by the same user.

create table if not exists public.bookmark_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookmark_collections_name_length
    check (char_length(trim(name)) between 1 and 60),
  constraint bookmark_collections_description_length
    check (description is null or char_length(description) <= 240)
);

create unique index if not exists bookmark_collections_user_name_unique
  on public.bookmark_collections (user_id, lower(trim(name)));

create index if not exists bookmark_collections_user_created_idx
  on public.bookmark_collections (user_id, created_at desc);

alter table if exists public.bookmarks
  add column if not exists collection_id uuid references public.bookmark_collections(id) on delete set null;

create index if not exists bookmarks_user_collection_created_idx
  on public.bookmarks (user_id, collection_id, created_at desc);

create or replace function public.set_bookmark_collections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_bookmark_collections_updated_at
  on public.bookmark_collections;

create trigger set_bookmark_collections_updated_at
before update on public.bookmark_collections
for each row
execute function public.set_bookmark_collections_updated_at();

create or replace function public.ensure_bookmark_collection_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  collection_owner uuid;
begin
  if new.collection_id is null then
    return new;
  end if;

  select user_id
  into collection_owner
  from public.bookmark_collections
  where id = new.collection_id;

  if collection_owner is null then
    raise exception 'Bookmark collection does not exist.';
  end if;

  if collection_owner <> new.user_id then
    raise exception 'Bookmark collection must belong to the bookmark owner.';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_bookmark_collection_owner
  on public.bookmarks;

create trigger ensure_bookmark_collection_owner
before insert or update of collection_id, user_id on public.bookmarks
for each row
execute function public.ensure_bookmark_collection_owner();

alter table public.bookmark_collections enable row level security;

drop policy if exists "Users can read their bookmark collections"
  on public.bookmark_collections;

create policy "Users can read their bookmark collections"
on public.bookmark_collections
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their bookmark collections"
  on public.bookmark_collections;

create policy "Users can create their bookmark collections"
on public.bookmark_collections
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their bookmark collections"
  on public.bookmark_collections;

create policy "Users can update their bookmark collections"
on public.bookmark_collections
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their bookmark collections"
  on public.bookmark_collections;

create policy "Users can delete their bookmark collections"
on public.bookmark_collections
for delete
using (auth.uid() = user_id);
