-- Bookmark Collections Premium gating for Loombus
-- Purpose:
-- - Keep existing saved/bookmark behavior available.
-- - Treat folders/collections as a Premium/Admin feature.
-- - Allow users to read their own collections.
-- - Allow only Premium/Admin users to create, update, delete, or assign bookmarks to collections.

create or replace function public.user_has_bookmark_collection_access(target_user_id uuid)
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

  if not public.user_has_bookmark_collection_access(new.user_id) then
    raise exception 'Bookmark collections require Premium or Admin access.';
  end if;

  return new;
end;
$$;

drop policy if exists "Users can create their bookmark collections"
  on public.bookmark_collections;

drop policy if exists "Premium users can create their bookmark collections"
  on public.bookmark_collections;

create policy "Premium users can create their bookmark collections"
on public.bookmark_collections
for insert
with check (
  auth.uid() = user_id
  and public.user_has_bookmark_collection_access(user_id)
);

drop policy if exists "Users can update their bookmark collections"
  on public.bookmark_collections;

drop policy if exists "Premium users can update their bookmark collections"
  on public.bookmark_collections;

create policy "Premium users can update their bookmark collections"
on public.bookmark_collections
for update
using (
  auth.uid() = user_id
  and public.user_has_bookmark_collection_access(user_id)
)
with check (
  auth.uid() = user_id
  and public.user_has_bookmark_collection_access(user_id)
);

drop policy if exists "Users can delete their bookmark collections"
  on public.bookmark_collections;

drop policy if exists "Premium users can delete their bookmark collections"
  on public.bookmark_collections;

create policy "Premium users can delete their bookmark collections"
on public.bookmark_collections
for delete
using (
  auth.uid() = user_id
  and public.user_has_bookmark_collection_access(user_id)
);
