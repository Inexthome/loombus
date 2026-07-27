-- Canonical platform-wide enforcement decisions, appeals, events, and restoration attempts.
-- Issue #665. Apply once after current account-enforcement and Room moderation migrations.

begin;

create table if not exists public.enforcement_decisions (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id uuid,
  target_label text,
  source_report_id uuid references public.reports(id) on delete set null,
  source_kind text not null default 'admin_action',
  source_key text unique,
  policy_document_id text not null default 'EA-001',
  policy_version text not null default 'implementation-v1',
  public_reason_code text not null default 'R16',
  primary_reason_code text not null default 'INTEGRITY.PLATFORM_POLICY',
  secondary_reason_codes text[] not null default '{}',
  context_modifiers text[] not null default '{}',
  severity text not null default 'S2',
  confidence text not null default 'C3',
  action_code text not null,
  action_scope text not null default 'target',
  action_parameters jsonb not null default '{}'::jsonb,
  member_explanation text not null,
  internal_note text,
  status text not null default 'active',
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  actor_user_id uuid references public.profiles(id) on delete set null,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  appeal_eligibility text not null default 'APL.ELIGIBLE',
  appeal_deadline timestamptz,
  notice_status text not null default 'pending',
  notice_sent_at timestamptz,
  restoration_status text not null default 'RST.NOT_APPLICABLE',
  restoration_note text,
  confidentiality text not null default 'standard',
  legal_hold boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enforcement_decisions_target_type_check check (
    target_type in (
      'account', 'profile', 'discussion', 'reply', 'message', 'room',
      'marketplace', 'business', 'service', 'request', 'job', 'event',
      'appointment'
    )
  ),
  constraint enforcement_decisions_public_reason_check check (
    public_reason_code in (
      'R01','R02','R03','R04','R05','R06','R07','R08',
      'R09','R10','R11','R12','R13','R14','R15','R16'
    )
  ),
  constraint enforcement_decisions_severity_check check (
    severity in ('S0','S1','S2','S3','S4','S5')
  ),
  constraint enforcement_decisions_confidence_check check (
    confidence in ('C0','C1','C2','C3','C4','C5')
  ),
  constraint enforcement_decisions_status_check check (
    status in (
      'active', 'expired', 'upheld', 'modified', 'reversed',
      'remanded', 'unable_to_review', 'superseded'
    )
  ),
  constraint enforcement_decisions_appeal_eligibility_check check (
    appeal_eligibility in (
      'APL.ELIGIBLE', 'APL.ELIGIBLE_AFTER_ACTION', 'APL.NOT_ELIGIBLE',
      'APL.LEGAL_RESTRICTION', 'APL.IDENTITY_OR_AUTHORITY_REQUIRED',
      'APL.DEADLINE_PASSED', 'APL.DUPLICATE_WITHOUT_NEW_INFORMATION',
      'APL.SYSTEM_NOT_SUPPORTED'
    )
  ),
  constraint enforcement_decisions_notice_status_check check (
    notice_status in ('pending', 'sent', 'failed', 'not_required')
  ),
  constraint enforcement_decisions_restoration_status_check check (
    restoration_status in (
      'RST.NOT_APPLICABLE', 'RST.PENDING', 'RST.COMPLETED', 'RST.PARTIAL',
      'RST.BLOCKED_LEGAL', 'RST.BLOCKED_TECHNICAL',
      'RST.SOURCE_NO_LONGER_EXISTS', 'RST.INDEPENDENT_RESTRICTION_REMAINS'
    )
  ),
  constraint enforcement_decisions_confidentiality_check check (
    confidentiality in ('standard', 'restricted', 'highly_restricted')
  )
);

create index if not exists enforcement_decisions_subject_recent_idx
  on public.enforcement_decisions(subject_user_id, created_at desc);
create index if not exists enforcement_decisions_target_recent_idx
  on public.enforcement_decisions(target_type, target_id, created_at desc);
create index if not exists enforcement_decisions_status_recent_idx
  on public.enforcement_decisions(status, created_at desc);
create index if not exists enforcement_decisions_appeal_queue_idx
  on public.enforcement_decisions(appeal_eligibility, appeal_deadline, created_at desc);
create index if not exists enforcement_decisions_source_report_idx
  on public.enforcement_decisions(source_report_id)
  where source_report_id is not null;

create table if not exists public.enforcement_appeals (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.enforcement_decisions(id) on delete cascade,
  appellant_user_id uuid not null references public.profiles(id) on delete cascade,
  statement text not null,
  additional_context text,
  has_new_information boolean not null default false,
  status text not null default 'APL.SUBMITTED',
  outcome text,
  assigned_reviewer_id uuid references public.profiles(id) on delete set null,
  conflict_status text not null default 'none',
  conflict_override_reason text,
  member_outcome_message text,
  internal_review_note text,
  submitted_at timestamptz not null default now(),
  review_started_at timestamptz,
  decided_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint enforcement_appeals_status_check check (
    status in (
      'APL.SUBMITTED', 'APL.NEEDS_INFORMATION', 'APL.QUEUED',
      'APL.UNDER_REVIEW', 'APL.SPECIALIST_REVIEW', 'APL.LEGAL_REVIEW',
      'APL.DECIDED', 'APL.CLOSED'
    )
  ),
  constraint enforcement_appeals_outcome_check check (
    outcome is null or outcome in (
      'APL.OUTCOME_UPHELD', 'APL.OUTCOME_MODIFIED',
      'APL.OUTCOME_REVERSED', 'APL.OUTCOME_REMANDED',
      'APL.OUTCOME_UNABLE_TO_REVIEW'
    )
  ),
  constraint enforcement_appeals_conflict_status_check check (
    conflict_status in ('none', 'potential', 'overridden', 'reassigned')
  ),
  constraint enforcement_appeals_statement_length_check check (
    char_length(statement) between 20 and 6000
  ),
  constraint enforcement_appeals_additional_context_length_check check (
    additional_context is null or char_length(additional_context) <= 6000
  )
);

create unique index if not exists enforcement_appeals_one_open_per_decision_idx
  on public.enforcement_appeals(decision_id)
  where status not in ('APL.DECIDED', 'APL.CLOSED');
create index if not exists enforcement_appeals_appellant_recent_idx
  on public.enforcement_appeals(appellant_user_id, submitted_at desc);
create index if not exists enforcement_appeals_queue_idx
  on public.enforcement_appeals(status, submitted_at asc);
create index if not exists enforcement_appeals_reviewer_queue_idx
  on public.enforcement_appeals(assigned_reviewer_id, status, submitted_at asc)
  where assigned_reviewer_id is not null;

create table if not exists public.enforcement_events (
  id bigint generated by default as identity primary key,
  decision_id uuid not null references public.enforcement_decisions(id) on delete cascade,
  appeal_id uuid references public.enforcement_appeals(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  member_visible boolean not null default false,
  member_message text,
  internal_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists enforcement_events_decision_recent_idx
  on public.enforcement_events(decision_id, created_at desc);
create index if not exists enforcement_events_appeal_recent_idx
  on public.enforcement_events(appeal_id, created_at desc)
  where appeal_id is not null;

create table if not exists public.enforcement_restoration_attempts (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.enforcement_decisions(id) on delete cascade,
  appeal_id uuid references public.enforcement_appeals(id) on delete set null,
  attempted_by uuid references public.profiles(id) on delete set null,
  adapter text not null,
  status text not null default 'RST.PENDING',
  result_message text,
  exception_code text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint enforcement_restoration_attempts_status_check check (
    status in (
      'RST.PENDING', 'RST.COMPLETED', 'RST.PARTIAL', 'RST.BLOCKED_LEGAL',
      'RST.BLOCKED_TECHNICAL', 'RST.SOURCE_NO_LONGER_EXISTS',
      'RST.INDEPENDENT_RESTRICTION_REMAINS'
    )
  )
);

create index if not exists enforcement_restoration_attempts_decision_idx
  on public.enforcement_restoration_attempts(decision_id, started_at desc);
create index if not exists enforcement_restoration_attempts_exception_idx
  on public.enforcement_restoration_attempts(status, started_at desc)
  where status <> 'RST.COMPLETED';

create or replace function public.touch_enforcement_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_enforcement_decisions_updated_at_trigger
  on public.enforcement_decisions;
create trigger touch_enforcement_decisions_updated_at_trigger
before update on public.enforcement_decisions
for each row execute function public.touch_enforcement_updated_at();

drop trigger if exists touch_enforcement_appeals_updated_at_trigger
  on public.enforcement_appeals;
create trigger touch_enforcement_appeals_updated_at_trigger
before update on public.enforcement_appeals
for each row execute function public.touch_enforcement_updated_at();

alter table public.enforcement_decisions enable row level security;
alter table public.enforcement_appeals enable row level security;
alter table public.enforcement_events enable row level security;
alter table public.enforcement_restoration_attempts enable row level security;

-- These records contain internal notes, confidential evidence references, reviewer
-- details, and restoration diagnostics. Authenticated clients receive only curated
-- server responses. Service-role routes remain the only direct data path.
revoke all on table public.enforcement_decisions from anon, authenticated;
revoke all on table public.enforcement_appeals from anon, authenticated;
revoke all on table public.enforcement_events from anon, authenticated;
revoke all on table public.enforcement_restoration_attempts from anon, authenticated;

revoke all on function public.touch_enforcement_updated_at() from public, anon, authenticated;

-- Import current account standing and recoverable Admin content removals. Imports
-- are marked as legacy because the original action predated canonical reason codes.
insert into public.enforcement_decisions (
  subject_user_id, target_type, target_id, target_label, source_kind, source_key,
  policy_document_id, policy_version, public_reason_code, primary_reason_code,
  severity, confidence, action_code, action_scope, action_parameters,
  member_explanation, internal_note, status, effective_at, expires_at,
  actor_user_id, appeal_eligibility, appeal_deadline, notice_status,
  restoration_status
)
select
  profile.id, 'account', profile.id, 'Loombus account', 'legacy_account_status',
  'legacy-account-status:' || profile.id::text || ':' || coalesce(profile.enforced_at::text, 'unknown'),
  'EA-001', 'legacy-import', 'R16', 'INTEGRITY.LEGACY_ACCOUNT_ENFORCEMENT',
  case when profile.account_status = 'banned' then 'S4'
       when profile.account_status = 'suspended' then 'S3' else 'S2' end,
  'C3',
  case when profile.account_status = 'banned' then 'ACT.ACCOUNT_REMOVE_PERMANENT'
       when profile.account_status = 'suspended' then 'ACT.ACCOUNT_SUSPEND'
       else 'ACT.ACCOUNT_WARNING' end,
  'account', jsonb_build_object('legacy_status', profile.account_status),
  coalesce(nullif(trim(profile.enforcement_reason), ''), 'Account access was changed by Loombus moderation.'),
  profile.enforcement_note, 'active', coalesce(profile.enforced_at, now()),
  profile.suspended_until, profile.enforced_by, 'APL.SYSTEM_NOT_SUPPORTED', null,
  'not_required', 'RST.PENDING'
from public.profiles profile
where profile.account_status in ('warned', 'suspended', 'banned')
on conflict (source_key) do nothing;

insert into public.enforcement_decisions (
  subject_user_id, target_type, target_id, target_label, source_kind, source_key,
  policy_document_id, policy_version, public_reason_code, primary_reason_code,
  severity, confidence, action_code, action_scope, action_parameters,
  member_explanation, status, effective_at, actor_user_id, appeal_eligibility,
  appeal_deadline, notice_status, restoration_status
)
select
  discussion.user_id, 'discussion', discussion.id, left(discussion.title, 240),
  'legacy_content_removal',
  'legacy-discussion-delete:' || discussion.id::text || ':' || discussion.deleted_at::text,
  'EA-001', 'legacy-import', 'R16', 'INTEGRITY.LEGACY_CONTENT_MODERATION',
  'S2', 'C3', 'ACT.CONTENT_REMOVE', 'content',
  jsonb_build_object('deleted_at', discussion.deleted_at),
  coalesce(nullif(trim(discussion.deletion_reason), ''), 'Your Discussion was removed by Loombus moderation.'),
  'active', discussion.deleted_at, discussion.deleted_by, 'APL.SYSTEM_NOT_SUPPORTED',
  null, 'not_required', 'RST.PENDING'
from public.discussions discussion
where discussion.deleted_at is not null
  and discussion.deleted_by is not null
  and discussion.deleted_by <> discussion.user_id
on conflict (source_key) do nothing;

insert into public.enforcement_decisions (
  subject_user_id, target_type, target_id, target_label, source_kind, source_key,
  policy_document_id, policy_version, public_reason_code, primary_reason_code,
  severity, confidence, action_code, action_scope, action_parameters,
  member_explanation, status, effective_at, actor_user_id, appeal_eligibility,
  appeal_deadline, notice_status, restoration_status
)
select
  reply.user_id, 'reply', reply.id, 'Reply in a Loombus Discussion',
  'legacy_content_removal',
  'legacy-reply-delete:' || reply.id::text || ':' || reply.deleted_at::text,
  'EA-001', 'legacy-import', 'R16', 'INTEGRITY.LEGACY_CONTENT_MODERATION',
  'S2', 'C3', 'ACT.CONTENT_REMOVE', 'content',
  jsonb_build_object('discussion_id', reply.discussion_id, 'deleted_at', reply.deleted_at),
  'Your Reply was removed by Loombus moderation.', 'active', reply.deleted_at,
  reply.deleted_by, 'APL.SYSTEM_NOT_SUPPORTED', null, 'not_required', 'RST.PENDING'
from public.replies reply
where reply.deleted_at is not null
  and reply.deleted_by is not null
  and reply.deleted_by <> reply.user_id
on conflict (source_key) do nothing;

insert into public.enforcement_events (
  decision_id, event_type, actor_user_id, member_visible, member_message, metadata
)
select
  decision.id, 'legacy_imported', decision.actor_user_id, true,
  'This decision was imported from the earlier Loombus moderation system.',
  jsonb_build_object('source_kind', decision.source_kind)
from public.enforcement_decisions decision
where decision.source_kind in ('legacy_account_status', 'legacy_content_removal')
  and not exists (
    select 1 from public.enforcement_events event
    where event.decision_id = decision.id and event.event_type = 'legacy_imported'
  );

-- New account status actions automatically become canonical decisions without
-- requiring every existing Admin surface to migrate in the same deployment.
create or replace function public.sync_account_enforcement_decision()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  decision_id uuid;
  prior_id uuid;
  action_code text;
  severity_code text;
  effective_time timestamptz;
begin
  if new.account_status in ('warned', 'suspended', 'banned')
     and (
       old.account_status is distinct from new.account_status
       or old.enforced_at is distinct from new.enforced_at
       or old.enforcement_reason is distinct from new.enforcement_reason
     ) then
    effective_time := coalesce(new.enforced_at, now());
    action_code := case
      when new.account_status = 'banned' then 'ACT.ACCOUNT_REMOVE_PERMANENT'
      when new.account_status = 'suspended' then 'ACT.ACCOUNT_SUSPEND'
      else 'ACT.ACCOUNT_WARNING'
    end;
    severity_code := case
      when new.account_status = 'banned' then 'S4'
      when new.account_status = 'suspended' then 'S3'
      else 'S2'
    end;

    for prior_id in
      update public.enforcement_decisions
      set status = 'superseded', resolved_at = effective_time
      where subject_user_id = new.id
        and target_type = 'account'
        and status in ('active', 'upheld', 'modified')
      returning id
    loop
      insert into public.enforcement_events (
        decision_id, event_type, actor_user_id, member_visible, member_message
      ) values (
        prior_id, 'decision_superseded', new.enforced_by, true,
        'This decision was replaced by a newer account decision.'
      );
    end loop;

    insert into public.enforcement_decisions (
      subject_user_id, target_type, target_id, target_label, source_kind,
      source_key, policy_document_id, policy_version, public_reason_code,
      primary_reason_code, severity, confidence, action_code, action_scope,
      action_parameters, member_explanation, internal_note, status,
      effective_at, expires_at, actor_user_id, appeal_eligibility,
      appeal_deadline, notice_status, restoration_status
    ) values (
      new.id, 'account', new.id, 'Loombus account', 'account_status_trigger',
      'account-status:' || new.id::text || ':' || effective_time::text || ':' || new.account_status,
      'EA-001', 'implementation-v1', 'R16', 'INTEGRITY.PLATFORM_POLICY',
      severity_code, 'C3', action_code, 'account',
      jsonb_build_object('account_status', new.account_status, 'suspended_until', new.suspended_until),
      coalesce(nullif(trim(new.enforcement_reason), ''), 'Loombus changed access to your account.'),
      new.enforcement_note, 'active', effective_time, new.suspended_until,
      new.enforced_by, 'APL.ELIGIBLE', effective_time + interval '30 days',
      'pending', 'RST.PENDING'
    )
    on conflict (source_key) do nothing
    returning id into decision_id;

    if decision_id is not null then
      insert into public.enforcement_events (
        decision_id, event_type, actor_user_id, member_visible, member_message,
        metadata
      ) values (
        decision_id, 'decision_created', new.enforced_by, true,
        coalesce(nullif(trim(new.enforcement_reason), ''), 'Loombus changed access to your account.'),
        jsonb_build_object('action_code', action_code, 'severity', severity_code)
      );
    end if;
  elsif new.account_status = 'active'
        and old.account_status in ('warned', 'suspended', 'banned') then
    for prior_id in
      update public.enforcement_decisions
      set status = 'reversed', resolved_at = coalesce(new.enforced_at, now()),
          reviewer_user_id = new.enforced_by,
          restoration_status = 'RST.COMPLETED',
          restoration_note = 'Account access was restored.'
      where subject_user_id = new.id
        and target_type = 'account'
        and status in ('active', 'upheld', 'modified')
      returning id
    loop
      insert into public.enforcement_events (
        decision_id, event_type, actor_user_id, member_visible, member_message
      ) values (
        prior_id, 'source_restored', new.enforced_by, true,
        'Your account access was restored.'
      );
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_account_enforcement_decision_trigger on public.profiles;
create trigger sync_account_enforcement_decision_trigger
after update of account_status, enforcement_reason, enforcement_note, enforced_at, suspended_until
on public.profiles
for each row execute function public.sync_account_enforcement_decision();

create or replace function public.sync_discussion_enforcement_decision()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  decision_id uuid;
  prior_id uuid;
begin
  if old.deleted_at is null and new.deleted_at is not null
     and new.deleted_by is not null and new.deleted_by <> new.user_id then
    insert into public.enforcement_decisions (
      subject_user_id, target_type, target_id, target_label, source_kind,
      source_key, policy_document_id, policy_version, public_reason_code,
      primary_reason_code, severity, confidence, action_code, action_scope,
      action_parameters, member_explanation, status, effective_at,
      actor_user_id, appeal_eligibility, appeal_deadline, notice_status,
      restoration_status
    ) values (
      new.user_id, 'discussion', new.id, left(new.title, 240), 'content_delete_trigger',
      'discussion-delete:' || new.id::text || ':' || new.deleted_at::text,
      'EA-001', 'implementation-v1', 'R16', 'INTEGRITY.CONTENT_POLICY',
      'S2', 'C3', 'ACT.CONTENT_REMOVE', 'content',
      jsonb_build_object('deleted_at', new.deleted_at),
      coalesce(nullif(trim(new.deletion_reason), ''), 'Your Discussion was removed by Loombus moderation.'),
      'active', new.deleted_at, new.deleted_by, 'APL.ELIGIBLE',
      new.deleted_at + interval '30 days', 'pending', 'RST.PENDING'
    )
    on conflict (source_key) do nothing
    returning id into decision_id;

    if decision_id is not null then
      insert into public.enforcement_events (
        decision_id, event_type, actor_user_id, member_visible, member_message
      ) values (
        decision_id, 'decision_created', new.deleted_by, true,
        coalesce(nullif(trim(new.deletion_reason), ''), 'Your Discussion was removed by Loombus moderation.')
      );
    end if;
  elsif old.deleted_at is not null and new.deleted_at is null then
    for prior_id in
      update public.enforcement_decisions
      set status = 'reversed', resolved_at = now(), reviewer_user_id = old.deleted_by,
          restoration_status = 'RST.COMPLETED',
          restoration_note = 'The Discussion was restored.'
      where target_type = 'discussion' and target_id = new.id
        and status in ('active', 'upheld', 'modified')
      returning id
    loop
      insert into public.enforcement_events (
        decision_id, event_type, actor_user_id, member_visible, member_message
      ) values (
        prior_id, 'source_restored', old.deleted_by, true,
        'Your Discussion was restored.'
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_discussion_enforcement_decision_trigger on public.discussions;
create trigger sync_discussion_enforcement_decision_trigger
after update of deleted_at, deleted_by, deletion_reason on public.discussions
for each row execute function public.sync_discussion_enforcement_decision();

create or replace function public.sync_reply_enforcement_decision()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  decision_id uuid;
  prior_id uuid;
begin
  if old.deleted_at is null and new.deleted_at is not null
     and new.deleted_by is not null and new.deleted_by <> new.user_id then
    insert into public.enforcement_decisions (
      subject_user_id, target_type, target_id, target_label, source_kind,
      source_key, policy_document_id, policy_version, public_reason_code,
      primary_reason_code, severity, confidence, action_code, action_scope,
      action_parameters, member_explanation, status, effective_at,
      actor_user_id, appeal_eligibility, appeal_deadline, notice_status,
      restoration_status
    ) values (
      new.user_id, 'reply', new.id, 'Reply in a Loombus Discussion',
      'content_delete_trigger',
      'reply-delete:' || new.id::text || ':' || new.deleted_at::text,
      'EA-001', 'implementation-v1', 'R16', 'INTEGRITY.CONTENT_POLICY',
      'S2', 'C3', 'ACT.CONTENT_REMOVE', 'content',
      jsonb_build_object('discussion_id', new.discussion_id, 'deleted_at', new.deleted_at),
      'Your Reply was removed by Loombus moderation.', 'active', new.deleted_at,
      new.deleted_by, 'APL.ELIGIBLE', new.deleted_at + interval '30 days',
      'pending', 'RST.PENDING'
    )
    on conflict (source_key) do nothing
    returning id into decision_id;

    if decision_id is not null then
      insert into public.enforcement_events (
        decision_id, event_type, actor_user_id, member_visible, member_message
      ) values (
        decision_id, 'decision_created', new.deleted_by, true,
        'Your Reply was removed by Loombus moderation.'
      );
    end if;
  elsif old.deleted_at is not null and new.deleted_at is null then
    for prior_id in
      update public.enforcement_decisions
      set status = 'reversed', resolved_at = now(), reviewer_user_id = old.deleted_by,
          restoration_status = 'RST.COMPLETED',
          restoration_note = 'The Reply was restored.'
      where target_type = 'reply' and target_id = new.id
        and status in ('active', 'upheld', 'modified')
      returning id
    loop
      insert into public.enforcement_events (
        decision_id, event_type, actor_user_id, member_visible, member_message
      ) values (
        prior_id, 'source_restored', old.deleted_by, true,
        'Your Reply was restored.'
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_reply_enforcement_decision_trigger on public.replies;
create trigger sync_reply_enforcement_decision_trigger
after update of deleted_at, deleted_by on public.replies
for each row execute function public.sync_reply_enforcement_decision();

revoke all on function public.sync_account_enforcement_decision()
  from public, anon, authenticated;
revoke all on function public.sync_discussion_enforcement_decision()
  from public, anon, authenticated;
revoke all on function public.sync_reply_enforcement_decision()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
