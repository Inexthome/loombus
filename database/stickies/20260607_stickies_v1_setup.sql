-- Stickies v1
-- Premium workspace board for pinning Loombus cards.
-- Saved = library/archive. Stickies = visible workspace.

create table if not exists public.sticky_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null,
  source_key text not null,
  title text not null,
  subtitle text,
  href text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sticky_items_item_type_check
    check (item_type in ('discussion', 'saved', 'person', 'topic', 'note', 'ai_summary')),
  constraint sticky_items_title_length
    check (char_length(title) <= 240),
  constraint sticky_items_subtitle_length
    check (subtitle is null or char_length(subtitle) <= 500),
  constraint sticky_items_href_length
    check (char_length(href) <= 500),
  constraint sticky_items_unique_source
    unique (user_id, item_type, source_key)
);

create index if not exists sticky_items_user_position_idx
on public.sticky_items (user_id, position asc, created_at desc);

create index if not exists sticky_items_user_type_idx
on public.sticky_items (user_id, item_type);

create or replace function public.user_has_stickies_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles profile
      where profile.id = target_user_id
        and profile.is_admin = true
    )
    or exists (
      select 1
      from public.user_ai_entitlements entitlement
      where entitlement.user_id = target_user_id
        and entitlement.ai_assisted_enabled = true
        and entitlement.tier in ('premium', 'admin')
    );
$$;

alter table public.sticky_items enable row level security;

drop policy if exists "Users can read their own stickies" on public.sticky_items;
create policy "Users can read their own stickies"
on public.sticky_items
for select
to authenticated
using (
  user_id = auth.uid()
  and public.user_has_stickies_access(auth.uid())
);

drop policy if exists "Premium users can create their own stickies" on public.sticky_items;
create policy "Premium users can create their own stickies"
on public.sticky_items
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.user_has_stickies_access(auth.uid())
);

drop policy if exists "Premium users can update their own stickies" on public.sticky_items;
create policy "Premium users can update their own stickies"
on public.sticky_items
for update
to authenticated
using (
  user_id = auth.uid()
  and public.user_has_stickies_access(auth.uid())
)
with check (
  user_id = auth.uid()
  and public.user_has_stickies_access(auth.uid())
);

drop policy if exists "Premium users can delete their own stickies" on public.sticky_items;
create policy "Premium users can delete their own stickies"
on public.sticky_items
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.user_has_stickies_access(auth.uid())
);

revoke all on table public.sticky_items from anon;
grant select, insert, update, delete on table public.sticky_items to authenticated;

comment on table public.sticky_items is
'Premium workspace items pinned by users. Separate from bookmarks/saved library.';
