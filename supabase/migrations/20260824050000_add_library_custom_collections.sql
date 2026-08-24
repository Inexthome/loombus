-- Loombus Library custom collections.
-- Collections organize existing Library publications without duplicating publication rows.
-- Scope: private owner-scoped collections and membership only.

create table if not exists public.library_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_collections_name_length_check check (char_length(btrim(name)) between 1 and 80),
  unique (id, user_id)
);

create unique index if not exists library_collections_user_name_unique_idx
  on public.library_collections(user_id, lower(btrim(name)));

create index if not exists library_collections_user_updated_idx
  on public.library_collections(user_id, updated_at desc);

create table if not exists public.library_collection_items (
  collection_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, publication_id),
  constraint library_collection_items_owner_fk
    foreign key (collection_id, user_id)
    references public.library_collections(id, user_id)
    on delete cascade,
  constraint library_collection_items_member_item_fk
    foreign key (user_id, publication_id)
    references public.library_member_items(user_id, publication_id)
    on delete cascade
);

create index if not exists library_collection_items_user_collection_idx
  on public.library_collection_items(user_id, collection_id, added_at desc);

create index if not exists library_collection_items_user_publication_idx
  on public.library_collection_items(user_id, publication_id);

alter table public.library_collections enable row level security;
alter table public.library_collection_items enable row level security;

drop policy if exists "members read own library collections" on public.library_collections;
create policy "members read own library collections"
on public.library_collections for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "members create own library collections" on public.library_collections;
create policy "members create own library collections"
on public.library_collections for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "members update own library collections" on public.library_collections;
create policy "members update own library collections"
on public.library_collections for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "members delete own library collections" on public.library_collections;
create policy "members delete own library collections"
on public.library_collections for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "members read own library collection items" on public.library_collection_items;
create policy "members read own library collection items"
on public.library_collection_items for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "members create own library collection items" on public.library_collection_items;
create policy "members create own library collection items"
on public.library_collection_items for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.library_collections collection
    where collection.id = collection_id
      and collection.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.library_member_items item
    where item.user_id = auth.uid()
      and item.publication_id = publication_id
  )
);

drop policy if exists "members delete own library collection items" on public.library_collection_items;
create policy "members delete own library collection items"
on public.library_collection_items for delete
to authenticated
using (auth.uid() = user_id);

revoke all on table public.library_collections from anon;
revoke all on table public.library_collection_items from anon;

grant select, insert, update, delete on table public.library_collections to authenticated;
grant select, insert, delete on table public.library_collection_items to authenticated;
