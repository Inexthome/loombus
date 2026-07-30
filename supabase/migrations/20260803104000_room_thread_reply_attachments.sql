-- Add private attachments to structured Room discussions and replies.
-- Existing Room post attachments remain valid and are migrated in place.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'room-post-attachments',
  'room-post-attachments',
  false,
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
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create unique index if not exists room_post_replies_id_room_unique_idx
  on public.room_post_replies (id, room_id);

alter table public.room_post_attachments
  add column if not exists reply_id uuid,
  add column if not exists video_duration_seconds integer,
  add column if not exists video_context_tier text;

alter table public.room_post_attachments
  alter column post_id drop not null;

alter table public.room_post_attachments
  drop constraint if exists room_post_attachments_reply_room_fk,
  drop constraint if exists room_post_attachments_parent_check,
  drop constraint if exists room_post_attachments_video_duration_check,
  drop constraint if exists room_post_attachments_video_tier_check,
  drop constraint if exists room_post_attachments_kind_mime_alignment_check,
  drop constraint if exists room_post_attachments_file_size_check;

alter table public.room_post_attachments
  add constraint room_post_attachments_reply_room_fk
    foreign key (reply_id, room_id)
    references public.room_post_replies(id, room_id)
    on delete cascade,
  add constraint room_post_attachments_parent_check
    check (
      (post_id is not null and reply_id is null)
      or
      (post_id is null and reply_id is not null)
    ),
  add constraint room_post_attachments_video_duration_check
    check (
      (
        kind = 'video'
        and (
          video_duration_seconds is null
          or (
            video_duration_seconds > 0
            and video_duration_seconds <= 180
          )
        )
      )
      or
      (
        kind <> 'video'
        and video_duration_seconds is null
      )
    ),
  add constraint room_post_attachments_video_tier_check
    check (
      video_context_tier is null
      or video_context_tier in ('free', 'premium', 'premium_plus', 'admin')
    ),
  add constraint room_post_attachments_kind_mime_alignment_check
    check (
      mime_type is null
      or (kind = 'image' and mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'))
      or (kind = 'file' and mime_type = 'application/pdf')
      or (kind = 'video' and mime_type in ('video/mp4', 'video/quicktime', 'video/webm'))
    ),
  add constraint room_post_attachments_file_size_check
    check (
      file_size is null
      or (
        file_size > 0
        and (
          (kind = 'video' and file_size <= 262144000)
          or (kind <> 'video' and file_size <= 10485760)
        )
      )
    );

create index if not exists room_post_attachments_reply_id_idx
  on public.room_post_attachments(reply_id)
  where reply_id is not null;
create index if not exists room_post_attachments_room_reply_idx
  on public.room_post_attachments(room_id, reply_id, created_at)
  where reply_id is not null;

create table if not exists public.room_video_upload_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  post_id uuid references public.room_posts(id) on delete set null,
  reply_id uuid references public.room_post_replies(id) on delete set null,
  attachment_id uuid references public.room_post_attachments(id) on delete set null,
  tier text not null check (tier in ('free', 'premium', 'premium_plus', 'admin')),
  video_duration_seconds integer not null check (
    video_duration_seconds > 0 and video_duration_seconds <= 180
  ),
  max_duration_seconds integer not null check (
    max_duration_seconds > 0 and max_duration_seconds <= 180
  ),
  file_size_bytes bigint not null check (
    file_size_bytes > 0 and file_size_bytes <= 262144000
  ),
  created_at timestamptz not null default now()
);

create index if not exists room_video_upload_events_user_created_idx
  on public.room_video_upload_events(user_id, created_at desc);
create index if not exists room_video_upload_events_room_created_idx
  on public.room_video_upload_events(room_id, created_at desc);
create index if not exists room_video_upload_events_attachment_idx
  on public.room_video_upload_events(attachment_id);

alter table public.room_video_upload_events enable row level security;

revoke all on table public.room_video_upload_events from anon;
revoke all on table public.room_video_upload_events from authenticated;
grant select on table public.room_video_upload_events to authenticated;

drop policy if exists "Users can read own Room video usage"
  on public.room_video_upload_events;
create policy "Users can read own Room video usage"
  on public.room_video_upload_events
  for select
  to authenticated
  using (auth.uid() = user_id);

comment on table public.room_video_upload_events is
  'Monthly usage ledger for private Room video attachments. Rows remain after attachment deletion so deleted videos still count against the monthly Video Context quota.';
comment on column public.room_post_attachments.reply_id is
  'Optional Room reply parent. Exactly one of post_id or reply_id must be present.';
comment on column public.room_post_attachments.video_duration_seconds is
  'Duration is required by the new server upload path. Null remains permitted only for legacy Room videos created before duration tracking.';

notify pgrst, 'reload schema';

commit;
