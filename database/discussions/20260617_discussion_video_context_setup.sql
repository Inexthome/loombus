-- Loombus Video Context v1
--
-- Purpose:
-- Extend discussion attachments to support one controlled video context per discussion.
--
-- Product rules:
-- - Video supports a written discussion; it is not a standalone feed.
-- - Free: 5 successful videos/month, 60 seconds max.
-- - Premium: 25 successful videos/month, 120 seconds max.
-- - Premium Plus: 50 successful videos/month, 180 seconds max.
-- - Deleted videos still count because upload usage events are retained.
-- - No public view-count table is introduced.

alter table public.discussion_attachments
add column if not exists video_duration_seconds integer;

alter table public.discussion_attachments
drop constraint if exists discussion_attachments_mime_type_check;

alter table public.discussion_attachments
add constraint discussion_attachments_mime_type_check
check (
  mime_type in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  )
);

alter table public.discussion_attachments
drop constraint if exists discussion_attachments_kind_check;

alter table public.discussion_attachments
add constraint discussion_attachments_kind_check
check (attachment_kind in ('image', 'pdf', 'video'));

alter table public.discussion_attachments
drop constraint if exists discussion_attachments_size_check;

alter table public.discussion_attachments
add constraint discussion_attachments_size_check
check (
  file_size_bytes > 0
  and (
    (attachment_kind = 'video' and file_size_bytes <= 262144000)
    or (attachment_kind <> 'video' and file_size_bytes <= 10485760)
  )
);

alter table public.discussion_attachments
drop constraint if exists discussion_attachments_video_duration_check;

alter table public.discussion_attachments
add constraint discussion_attachments_video_duration_check
check (
  (
    attachment_kind = 'video'
    and video_duration_seconds is not null
    and video_duration_seconds > 0
    and video_duration_seconds <= 180
  )
  or (
    attachment_kind <> 'video'
    and video_duration_seconds is null
  )
);

alter table public.discussion_attachments
drop constraint if exists discussion_attachments_kind_mime_alignment_check;

alter table public.discussion_attachments
add constraint discussion_attachments_kind_mime_alignment_check
check (
  (attachment_kind = 'image' and mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'))
  or (attachment_kind = 'pdf' and mime_type = 'application/pdf')
  or (attachment_kind = 'video' and mime_type in ('video/mp4', 'video/quicktime', 'video/webm'))
);

create unique index if not exists discussion_attachments_one_video_per_discussion_idx
on public.discussion_attachments(discussion_id)
where attachment_kind = 'video';

create table if not exists public.discussion_video_upload_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discussion_id uuid references public.discussions(id) on delete set null,
  attachment_id uuid references public.discussion_attachments(id) on delete set null,
  tier text not null check (tier in ('free', 'premium', 'premium_plus', 'admin')),
  video_duration_seconds integer not null check (video_duration_seconds > 0 and video_duration_seconds <= 180),
  max_duration_seconds integer not null check (max_duration_seconds > 0 and max_duration_seconds <= 180),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 262144000),
  created_at timestamptz not null default now()
);

create index if not exists discussion_video_upload_events_user_created_idx
on public.discussion_video_upload_events(user_id, created_at desc);

create index if not exists discussion_video_upload_events_attachment_idx
on public.discussion_video_upload_events(attachment_id);

alter table public.discussion_video_upload_events enable row level security;

revoke all on table public.discussion_video_upload_events from anon;
revoke all on table public.discussion_video_upload_events from authenticated;

grant select on table public.discussion_video_upload_events to authenticated;

drop policy if exists "Users can read own video context usage"
on public.discussion_video_upload_events;

create policy "Users can read own video context usage"
on public.discussion_video_upload_events
for select
to authenticated
using (auth.uid() = user_id);

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
  262144000,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.discussion_attachments.video_duration_seconds is
'Video Context duration in seconds. Null for image and PDF attachments.';

comment on table public.discussion_video_upload_events is
'Monthly usage ledger for Loombus Video Context uploads. Rows remain even when videos are deleted so deleted videos still count against the monthly quota.';
