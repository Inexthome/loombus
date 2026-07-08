create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit)
values ('room-post-attachments', 'room-post-attachments', false, 104857600)
on conflict (id) do update
set public = false,
    file_size_limit = 104857600;

create table if not exists public.room_post_attachments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  post_id uuid not null references public.room_posts(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  storage_bucket text not null default 'room-post-attachments',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  kind text not null default 'file' check (kind in ('image', 'video', 'file')),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

alter table public.room_post_attachments enable row level security;

create index if not exists room_post_attachments_room_id_idx on public.room_post_attachments(room_id);
create index if not exists room_post_attachments_post_id_idx on public.room_post_attachments(post_id);
create index if not exists room_post_attachments_created_at_idx on public.room_post_attachments(created_at desc);

drop policy if exists "Room members can read post attachments" on public.room_post_attachments;
create policy "Room members can read post attachments"
on public.room_post_attachments
for select
to authenticated
using (
  exists (
    select 1 from public.room_members member
    where member.room_id = room_post_attachments.room_id
      and member.user_id = auth.uid()
  )
  or exists (
    select 1 from public.rooms room
    where room.id = room_post_attachments.room_id
      and (room.owner_id = auth.uid() or room.created_by = auth.uid())
  )
);

drop policy if exists "Room members can create post attachments" on public.room_post_attachments;
create policy "Room members can create post attachments"
on public.room_post_attachments
for insert
to authenticated
with check (
  uploader_id = auth.uid()
  and exists (
    select 1 from public.room_posts post
    where post.id = room_post_attachments.post_id
      and post.room_id = room_post_attachments.room_id
  )
  and (
    exists (
      select 1 from public.room_members member
      where member.room_id = room_post_attachments.room_id
        and member.user_id = auth.uid()
    )
    or exists (
      select 1 from public.rooms room
      where room.id = room_post_attachments.room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  )
);

drop policy if exists "Uploaders and room owners can delete post attachments" on public.room_post_attachments;
create policy "Uploaders and room owners can delete post attachments"
on public.room_post_attachments
for delete
to authenticated
using (
  uploader_id = auth.uid()
  or exists (
    select 1 from public.rooms room
    where room.id = room_post_attachments.room_id
      and (room.owner_id = auth.uid() or room.created_by = auth.uid())
  )
);

drop policy if exists "Room members can read uploaded post files" on storage.objects;
create policy "Room members can read uploaded post files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'room-post-attachments'
  and (
    exists (
      select 1 from public.room_members member
      where member.room_id = ((storage.foldername(name))[1])::uuid
        and member.user_id = auth.uid()
    )
    or exists (
      select 1 from public.rooms room
      where room.id = ((storage.foldername(name))[1])::uuid
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  )
);

drop policy if exists "Room members can upload post files" on storage.objects;
create policy "Room members can upload post files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'room-post-attachments'
  and owner = auth.uid()
  and (
    exists (
      select 1 from public.room_members member
      where member.room_id = ((storage.foldername(name))[1])::uuid
        and member.user_id = auth.uid()
    )
    or exists (
      select 1 from public.rooms room
      where room.id = ((storage.foldername(name))[1])::uuid
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    )
  )
);

drop policy if exists "Uploaders can manage uploaded post files" on storage.objects;
create policy "Uploaders can manage uploaded post files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'room-post-attachments'
  and owner = auth.uid()
);
