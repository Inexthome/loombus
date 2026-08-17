-- Loombus Library Research workspace foundation.
-- Adds member-private organization around immutable saved passage provenance.
--
-- Research passage provenance in library_research_items remains unchanged and is not
-- made browser-updatable. Editable notes/tags live in a separate metadata table so a
-- member cannot mutate publication/locator/offset/hash provenance through an UPDATE.

create table if not exists public.library_research_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_research_collections_name_check check (
    char_length(btrim(name)) between 1 and 80
  ),
  constraint library_research_collections_description_check check (
    description is null or char_length(description) <= 500
  )
);

create unique index if not exists library_research_collections_user_name_unique_idx
  on public.library_research_collections(user_id, lower(btrim(name)));

create index if not exists library_research_collections_user_updated_idx
  on public.library_research_collections(user_id, updated_at desc);

create table if not exists public.library_research_item_metadata (
  research_item_id uuid primary key references public.library_research_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_research_item_metadata_note_check check (
    note is null or char_length(note) <= 10000
  ),
  constraint library_research_item_metadata_tags_count_check check (
    cardinality(tags) <= 20
  )
);

create index if not exists library_research_item_metadata_user_updated_idx
  on public.library_research_item_metadata(user_id, updated_at desc);

create table if not exists public.library_research_collection_items (
  collection_id uuid not null references public.library_research_collections(id) on delete cascade,
  research_item_id uuid not null references public.library_research_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, research_item_id)
);

create index if not exists library_research_collection_items_item_idx
  on public.library_research_collection_items(research_item_id, created_at desc);

alter table public.library_research_collections enable row level security;
alter table public.library_research_item_metadata enable row level security;
alter table public.library_research_collection_items enable row level security;

-- Collections are fully private to their owner.
drop policy if exists "members read own library research collections" on public.library_research_collections;
create policy "members read own library research collections"
  on public.library_research_collections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members create own library research collections" on public.library_research_collections;
create policy "members create own library research collections"
  on public.library_research_collections
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "members update own library research collections" on public.library_research_collections;
create policy "members update own library research collections"
  on public.library_research_collections
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "members delete own library research collections" on public.library_research_collections;
create policy "members delete own library research collections"
  on public.library_research_collections
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Metadata is private and can only be attached to a research passage owned by the same member.
drop policy if exists "members read own library research metadata" on public.library_research_item_metadata;
create policy "members read own library research metadata"
  on public.library_research_item_metadata
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members create metadata for own research items" on public.library_research_item_metadata;
create policy "members create metadata for own research items"
  on public.library_research_item_metadata
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.library_research_items item
      where item.id = library_research_item_metadata.research_item_id
        and item.user_id = auth.uid()
    )
  );

drop policy if exists "members update metadata for own research items" on public.library_research_item_metadata;
create policy "members update metadata for own research items"
  on public.library_research_item_metadata
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.library_research_items item
      where item.id = library_research_item_metadata.research_item_id
        and item.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.library_research_items item
      where item.id = library_research_item_metadata.research_item_id
        and item.user_id = auth.uid()
    )
  );

drop policy if exists "members delete own library research metadata" on public.library_research_item_metadata;
create policy "members delete own library research metadata"
  on public.library_research_item_metadata
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Collection membership is visible/mutable only when the member owns both sides.
drop policy if exists "members read own library research collection items" on public.library_research_collection_items;
create policy "members read own library research collection items"
  on public.library_research_collection_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.library_research_collections collection
      where collection.id = library_research_collection_items.collection_id
        and collection.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_items item
      where item.id = library_research_collection_items.research_item_id
        and item.user_id = auth.uid()
    )
  );

drop policy if exists "members organize own library research collection items" on public.library_research_collection_items;
create policy "members organize own library research collection items"
  on public.library_research_collection_items
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.library_research_collections collection
      where collection.id = library_research_collection_items.collection_id
        and collection.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_items item
      where item.id = library_research_collection_items.research_item_id
        and item.user_id = auth.uid()
    )
  );

drop policy if exists "members remove own library research collection items" on public.library_research_collection_items;
create policy "members remove own library research collection items"
  on public.library_research_collection_items
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.library_research_collections collection
      where collection.id = library_research_collection_items.collection_id
        and collection.user_id = auth.uid()
    )
    and exists (
      select 1 from public.library_research_items item
      where item.id = library_research_collection_items.research_item_id
        and item.user_id = auth.uid()
    )
  );

revoke all on table public.library_research_collections from anon;
revoke all on table public.library_research_item_metadata from anon;
revoke all on table public.library_research_collection_items from anon;

revoke all on table public.library_research_collections from authenticated;
revoke all on table public.library_research_item_metadata from authenticated;
revoke all on table public.library_research_collection_items from authenticated;

grant select, insert, update, delete on table public.library_research_collections to authenticated;
grant select, insert, update, delete on table public.library_research_item_metadata to authenticated;
grant select, insert, delete on table public.library_research_collection_items to authenticated;

comment on table public.library_research_collections is
  'Member-private named collections used to organize saved Library research passages.';
comment on table public.library_research_item_metadata is
  'Member-private editable notes and tags for immutable Library research passage provenance.';
comment on table public.library_research_collection_items is
  'Member-private many-to-many membership between Library research passages and collections.';
