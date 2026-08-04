create table if not exists public.room_documents (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  resource_id uuid references public.room_resources(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

-- room_documents may already exist from an earlier Room files implementation.
-- Upgrade that table in place before indexes or application code reference the
-- Documents-library columns.
alter table public.room_documents
  add column if not exists resource_id uuid references public.room_resources(id) on delete cascade,
  add column if not exists document_group_id uuid,
  add column if not exists uploaded_by uuid references public.profiles(id) on delete cascade,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists visibility text,
  add column if not exists tags text[],
  add column if not exists version_number integer,
  add column if not exists is_current boolean,
  add column if not exists is_pinned boolean,
  add column if not exists status text,
  add column if not exists download_count bigint,
  add column if not exists published_at timestamptz,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.room_documents
set
  document_group_id = coalesce(document_group_id, gen_random_uuid()),
  category = coalesce(category, 'other'),
  visibility = coalesce(visibility, 'members'),
  tags = coalesce(tags, '{}'::text[]),
  version_number = coalesce(version_number, 1),
  is_current = coalesce(is_current, true),
  is_pinned = coalesce(is_pinned, false),
  status = coalesce(status, 'published'),
  download_count = coalesce(download_count, 0),
  published_at = coalesce(published_at, created_at, now()),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

alter table public.room_documents
  alter column document_group_id set default gen_random_uuid(),
  alter column category set default 'other',
  alter column visibility set default 'members',
  alter column tags set default '{}'::text[],
  alter column version_number set default 1,
  alter column is_current set default true,
  alter column is_pinned set default false,
  alter column status set default 'published',
  alter column download_count set default 0,
  alter column published_at set default now(),
  alter column created_at set default now(),
  alter column updated_at set default now();

create unique index if not exists room_documents_resource_id_idx
  on public.room_documents(resource_id)
  where resource_id is not null;
create unique index if not exists room_documents_group_version_idx
  on public.room_documents(document_group_id, version_number)
  where document_group_id is not null and version_number is not null;
create unique index if not exists room_documents_one_current_idx
  on public.room_documents(document_group_id)
  where document_group_id is not null and is_current = true and status = 'published';
create index if not exists room_documents_room_current_idx
  on public.room_documents(room_id, is_current, is_pinned desc, updated_at desc);
create index if not exists room_documents_room_category_idx
  on public.room_documents(room_id, category, updated_at desc);
create index if not exists room_documents_tags_idx
  on public.room_documents using gin(tags);

alter table public.room_documents enable row level security;
revoke all on public.room_documents from anon, authenticated;
grant all on public.room_documents to service_role;

comment on table public.room_documents is 'Private metadata, visibility, and version history for files stored in room_resources.';
