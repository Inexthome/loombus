begin;

alter table public.room_moderation_queue
  add column if not exists category text,
  add column if not exists priority text not null default 'normal',
  add column if not exists evidence_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists report_count integer not null default 1,
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_by uuid references auth.users(id) on delete set null,
  add column if not exists resolution_action text,
  add column if not exists reporter_notified_at timestamptz;

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_priority_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent'));

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_category_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_category_check
  check (
    category is null or category in (
      'harassment', 'hate', 'threat', 'spam', 'privacy',
      'misinformation', 'unsafe_content', 'impersonation', 'other'
    )
  );

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_resolution_action_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_resolution_action_check
  check (
    resolution_action is null or resolution_action in (
      'none', 'warning', 'content_removed', 'member_suspended',
      'member_removed', 'escalated_to_loombus'
    )
  );

create index if not exists room_moderation_queue_assignee_idx
  on public.room_moderation_queue (room_id, assigned_to, status, created_at desc);

create index if not exists room_moderation_queue_priority_idx
  on public.room_moderation_queue (room_id, priority, status, created_at desc);

create unique index if not exists room_moderation_queue_open_reporter_target_idx
  on public.room_moderation_queue (room_id, target_type, target_id, reported_by)
  where status in ('open', 'reviewing') and target_id is not null and reported_by is not null;

commit;