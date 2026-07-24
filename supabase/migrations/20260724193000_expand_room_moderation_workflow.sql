begin;

alter table public.room_moderation_queue
  add column if not exists category text not null default 'other',
  add column if not exists priority text not null default 'normal',
  add column if not exists source text not null default 'manual',
  add column if not exists reporter_note text,
  add column if not exists evidence_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists assigned_by uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists escalated_by uuid references auth.users(id) on delete set null,
  add column if not exists escalated_at timestamptz,
  add column if not exists affected_user_id uuid references auth.users(id) on delete set null,
  add column if not exists last_action_at timestamptz not null default now(),
  add column if not exists resolution_action text,
  add column if not exists reporter_notified_at timestamptz;

update public.room_moderation_queue
set category = 'other'
where category is null;

alter table public.room_moderation_queue
  alter column category set default 'other',
  alter column category set not null;

update public.room_moderation_queue
set target_type = 'other', target_id = null
where target_type <> 'other' and target_id is null;

update public.room_moderation_queue
set target_id = null
where target_type = 'other' and target_id is not null;

update public.room_moderation_queue
set resolution_note = left(resolution_note, 2000)
where resolution_note is not null and char_length(resolution_note) > 2000;

with ranked_open_reports as (
  select
    id,
    row_number() over (
      partition by room_id, target_type, target_id, reported_by
      order by created_at asc, id asc
    ) as duplicate_rank
  from public.room_moderation_queue
  where status in ('open', 'reviewing')
    and target_id is not null
    and reported_by is not null
)
update public.room_moderation_queue as queue
set
  status = 'dismissed',
  resolution_note = coalesce(
    nullif(btrim(queue.resolution_note), ''),
    'Superseded by an earlier open report from the same reporter for this Room item.'
  ),
  resolution_action = 'none',
  resolved_at = coalesce(queue.resolved_at, now()),
  last_action_at = now(),
  updated_at = now()
from ranked_open_reports
where queue.id = ranked_open_reports.id
  and ranked_open_reports.duplicate_rank > 1;

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_target_type_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_target_type_check
  check (target_type in ('room_post','room_post_reply','room_attachment','room_member','other'));

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_target_shape_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_target_shape_check
  check (
    (target_type = 'other' and target_id is null)
    or (target_type <> 'other' and target_id is not null)
  );

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_status_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_status_check
  check (status in ('open','reviewing','resolved','dismissed'));

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_category_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_category_check
  check (category in (
    'harassment','hate','threat','spam','privacy','safety','misinformation',
    'unsafe_content','impersonation','conduct','other'
  ));

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

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_resolution_action_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_resolution_action_check
  check (
    resolution_action is null or resolution_action in (
      'none','warning','content_removed','member_suspended','member_removed'
    )
  );

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_evidence_snapshot_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_evidence_snapshot_check
  check (jsonb_typeof(evidence_snapshot) = 'object');

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_reporter_note_length_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_reporter_note_length_check
  check (reporter_note is null or char_length(reporter_note) <= 4000);

alter table public.room_moderation_queue
  drop constraint if exists room_moderation_queue_resolution_note_length_check;
alter table public.room_moderation_queue
  add constraint room_moderation_queue_resolution_note_length_check
  check (resolution_note is null or char_length(resolution_note) <= 2000);

create index if not exists room_moderation_queue_assignment_idx
  on public.room_moderation_queue (room_id, assigned_to, status, created_at desc);
create index if not exists room_moderation_queue_priority_idx
  on public.room_moderation_queue (room_id, priority, status, created_at desc);
create index if not exists room_moderation_queue_reporter_idx
  on public.room_moderation_queue (room_id, reported_by, created_at desc);
create index if not exists room_moderation_queue_escalation_idx
  on public.room_moderation_queue (room_id, escalated_at desc)
  where escalated_at is not null;

create unique index if not exists room_moderation_queue_open_report_unique
  on public.room_moderation_queue (room_id, target_type, target_id, reported_by)
  where status in ('open','reviewing') and target_id is not null and reported_by is not null;

commit;
