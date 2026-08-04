create table if not exists public.room_documents (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  resource_id uuid not null unique references public.room_resources(id) on delete cascade,
  document_group_id uuid not null default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'other',
  visibility text not null default 'members',
  tags text[] not null default '{}',
  version_number integer not null default 1,
  is_current boolean not null default true,
  is_pinned boolean not null default false,
  status text not null default 'published',
  download_count bigint not null default 0,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_documents_title_length check (char_length(title) between 2 and 200),
  constraint room_documents_description_length check (description is null or char_length(description) <= 4000),
  constraint room_documents_category_check check (category in ('governing','minutes','financial','forms','policies','newsletters','maps','emergency','other')),
  constraint room_documents_visibility_check check (visibility in ('members','board','managers')),
  constraint room_documents_status_check check (status in ('published','archived')),
  constraint room_documents_version_positive check (version_number > 0)
);

create unique index if not exists room_documents_group_version_idx
  on public.room_documents(document_group_id, version_number);
create unique index if not exists room_documents_one_current_idx
  on public.room_documents(document_group_id)
  where is_current = true and status = 'published';
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