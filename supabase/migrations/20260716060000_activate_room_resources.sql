-- Activate private Room file and inline video resources.
-- Uploads and downloads use short-lived signed Storage URLs issued only after
-- the server verifies active Room membership and the Room plan entitlement.

begin;

create table if not exists public.room_resources (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  media_kind text not null default 'file',
  file_size_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint room_resources_media_kind_check
    check (media_kind in ('file', 'image', 'video')),
  constraint room_resources_size_check
    check (file_size_bytes > 0),
  constraint room_resources_name_check
    check (char_length(file_name) between 1 and 240)
);

alter table public.room_resources
  add column if not exists uploaded_by uuid references auth.users(id) on delete cascade,
  add column if not exists file_name text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists media_kind text not null default 'file',
  add column if not exists file_size_bytes bigint,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists room_resources_storage_path_unique_idx
  on public.room_resources (storage_path);
create index if not exists room_resources_room_created_idx
  on public.room_resources (room_id, created_at desc);
create index if not exists room_resources_uploader_idx
  on public.room_resources (uploaded_by, created_at desc);

alter table public.room_resources enable row level security;

drop policy if exists "Room resources are visible to active members"
  on public.room_resources;
create policy "Room resources are visible to active members"
on public.room_resources for select to authenticated
using (public.user_is_active_room_member(room_id));

revoke all on table public.room_resources from anon;
revoke insert, update, delete on table public.room_resources from authenticated;
grant select on table public.room_resources to authenticated;

alter table public.room_resources replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_resources'
  ) then
    alter publication supabase_realtime add table public.room_resources;
  end if;
end
$$;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'room-resources',
  'room-resources',
  false,
  1073741824,
  array[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
