-- Loombus discussion attachments v1
--
-- Purpose:
-- Add controlled discussion attachments for images and PDFs.
--
-- v1 rules:
-- - Attachments belong to discussions only.
-- - Images and PDFs only.
-- - Max 10 MB per file.
-- - Max 3 attachments per discussion.
-- - Public read for attachments connected to non-deleted public discussions.
-- - Metadata writes are intended to happen through server/API service-role code.

create table if not exists public.discussion_attachments (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_bucket text not null default 'discussion-attachments',
  storage_path text not null,
  public_url text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  attachment_kind text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint discussion_attachments_bucket_check
    check (storage_bucket = 'discussion-attachments'),

  constraint discussion_attachments_mime_type_check
    check (
      mime_type in (
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf'
      )
    ),

  constraint discussion_attachments_kind_check
    check (attachment_kind in ('image', 'pdf')),

  constraint discussion_attachments_size_check
    check (file_size_bytes > 0 and file_size_bytes <= 10485760),

  constraint discussion_attachments_sort_order_check
    check (sort_order >= 0 and sort_order <= 2),

  constraint discussion_attachments_storage_path_owner_check
    check (storage_path like (user_id::text || '/%')),

  constraint discussion_attachments_public_url_length_check
    check (char_length(trim(public_url)) > 0 and char_length(public_url) <= 2048),

  constraint discussion_attachments_file_name_length_check
    check (char_length(trim(file_name)) > 0 and char_length(file_name) <= 255),

  constraint discussion_attachments_unique_path
    unique (storage_bucket, storage_path),

  constraint discussion_attachments_unique_discussion_sort
    unique (discussion_id, sort_order)
);

create index if not exists discussion_attachments_discussion_sort_idx
on public.discussion_attachments(discussion_id, sort_order, created_at);

create index if not exists discussion_attachments_user_created_idx
on public.discussion_attachments(user_id, created_at desc);

create index if not exists discussion_attachments_kind_idx
on public.discussion_attachments(attachment_kind);

alter table public.discussion_attachments enable row level security;

revoke all on table public.discussion_attachments from anon;
revoke all on table public.discussion_attachments from authenticated;

grant select on table public.discussion_attachments to anon;
grant select on table public.discussion_attachments to authenticated;

drop policy if exists "Public can read attachments for visible discussions"
on public.discussion_attachments;

create policy "Public can read attachments for visible discussions"
on public.discussion_attachments
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.discussions discussion
    where discussion.id = discussion_attachments.discussion_id
      and discussion.deleted_at is null
  )
);

create or replace function public.enforce_discussion_attachment_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.discussion_attachments existing
    where existing.discussion_id = new.discussion_id
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) >= 3 then
    raise exception 'A discussion can have at most 3 attachments.';
  end if;

  return new;
end;
$$;

drop trigger if exists discussion_attachments_limit_trigger
on public.discussion_attachments;

create trigger discussion_attachments_limit_trigger
before insert on public.discussion_attachments
for each row
execute function public.enforce_discussion_attachment_limit();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'discussion-attachments',
  'discussion-attachments',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Discussion attachments are publicly readable"
on storage.objects;

create policy "Discussion attachments are publicly readable"
on storage.objects
for select
using (bucket_id = 'discussion-attachments');

drop policy if exists "Users can upload own discussion attachments"
on storage.objects;

create policy "Users can upload own discussion attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'discussion-attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update own discussion attachments"
on storage.objects;

create policy "Users can update own discussion attachments"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'discussion-attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'discussion-attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own discussion attachments"
on storage.objects;

create policy "Users can delete own discussion attachments"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'discussion-attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
);

comment on table public.discussion_attachments is
'Metadata for images and PDFs attached to Loombus discussions.';

comment on column public.discussion_attachments.storage_path is
'Storage object path inside the discussion-attachments bucket. First folder must be the uploader profile id.';

comment on column public.discussion_attachments.public_url is
'Public storage URL used to display the attachment.';

comment on column public.discussion_attachments.attachment_kind is
'Attachment display type: image or pdf.';
