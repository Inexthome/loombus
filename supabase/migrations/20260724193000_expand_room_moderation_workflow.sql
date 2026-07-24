begin;

alter table public.room_moderation_queue
  add column if not exists category text not null default 'other',
  add column if not exists priority text not null default 'normal',
  add column if not exists source text not null default 'manual',
  add column if not exists reporter_note text,
  add column if not exists evidence_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists assigned_by uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists escalated_by uuid references auth.users(id) on delete set null,
  add column if not exists escalated_at timestamptz,
  add column if not exists affected_user_id uuid references auth.users(id) on delete set null,
  add column if not exists last_action_at timestamptz not null default now();

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_category_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_category_check
  check (category in ('harassment','spam','privacy','safety','misinformation','conduct','other'));

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_priority_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_priority_check
  check (priority in ('low','normal','high','urgent'));

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_source_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_source_check
  check (source in ('member_report','staff_report','system','manual'));

create index if not exists room_moderation_queue_assignment_idx
  on public.room_moderation_queue (room_id, assigned_to, status, created_at desc);
create index if not exists room_moderation_queue_priority_idx
  on public.room_moderation_queue (room_id, priority, status, created_at desc);
create index if not exists room_moderation_queue_reporter_idx
  on public.room_moderation_queue (room_id, reported_by, created_at desc);

create unique index if not exists room_moderation_queue_open_report_unique
  on public.room_moderation_queue (room_id, target_type, target_id, reported_by)
  where status in ('open','in_review','escalated') and target_id is not null;

commit;
