-- Controlled review and retry workflow for blocked account deletion requests.
-- This does not enable deletion or anonymization handlers.

alter table public.account_deletion_dispositions
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists verification_evidence jsonb,
  add column if not exists irreversible boolean not null default false;

alter table public.account_deletion_dispositions
  drop constraint if exists account_deletion_dispositions_review_note_length;
alter table public.account_deletion_dispositions
  add constraint account_deletion_dispositions_review_note_length
  check (review_note is null or char_length(trim(review_note)) between 10 and 4000);

alter table public.account_deletion_events
  drop constraint if exists account_deletion_events_type_check;
alter table public.account_deletion_events
  add constraint account_deletion_events_type_check check (event_type in (
    'requested', 'review_started', 'disposition_reviewed', 'requeued',
    'processing_started', 'processing_blocked', 'processing_failed',
    'completed', 'cancelled'
  ));

create or replace function public.review_account_deletion_disposition(
  p_request_id uuid,
  p_resource_key text,
  p_resolution text,
  p_note text,
  p_evidence jsonb,
  p_irreversible boolean default false
)
returns table (request_id uuid, resource_key text, status text, reviewed_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  request_record public.account_deletion_requests%rowtype;
  registry_record public.account_deletion_resource_registry%rowtype;
  clean_note text := nullif(left(trim(coalesce(p_note, '')), 4000), '');
  review_time timestamptz := now();
begin
  if actor_id is null or not exists (
    select 1 from public.profiles p where p.id = actor_id and p.is_admin = true
  ) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if p_resolution not in ('completed', 'not_applicable') then
    raise exception 'Resolution must be completed or not_applicable.' using errcode = '22023';
  end if;
  if clean_note is null or char_length(clean_note) < 10 then
    raise exception 'A review note of at least 10 characters is required.' using errcode = '22023';
  end if;
  if p_evidence is null or p_evidence = '{}'::jsonb or jsonb_typeof(p_evidence) <> 'object' then
    raise exception 'Structured verification evidence is required.' using errcode = '22023';
  end if;

  select * into request_record
  from public.account_deletion_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'Deletion request not found.' using errcode = 'P0002';
  end if;
  if request_record.status not in ('reviewing', 'blocked', 'failed') then
    raise exception 'This request is not available for disposition review.' using errcode = '55000';
  end if;

  select * into registry_record
  from public.account_deletion_resource_registry
  where resource_key = p_resource_key and enabled = true;
  if not found then
    raise exception 'Enabled deletion resource not found.' using errcode = 'P0002';
  end if;
  if registry_record.execution_mode = 'automatic' then
    raise exception 'Automatic handlers cannot be completed by manual review.' using errcode = '55000';
  end if;

  insert into public.account_deletion_dispositions (
    request_id, resource_key, data_class, system_of_record, disposition,
    status, exception_code, detail, verified_at, reviewed_by, reviewed_at,
    review_note, verification_evidence, irreversible, updated_at
  ) values (
    p_request_id, registry_record.resource_key, registry_record.data_class,
    registry_record.system_of_record, registry_record.disposition,
    p_resolution, null,
    jsonb_build_object('message', 'Evidence-backed operator review completed.'),
    review_time, actor_id, review_time, clean_note, p_evidence,
    coalesce(p_irreversible, false), review_time
  )
  on conflict (request_id, resource_key) do update set
    status = excluded.status,
    exception_code = null,
    detail = excluded.detail,
    verified_at = excluded.verified_at,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    review_note = excluded.review_note,
    verification_evidence = excluded.verification_evidence,
    irreversible = excluded.irreversible,
    updated_at = excluded.updated_at;

  if request_record.status <> 'reviewing' then
    update public.account_deletion_requests
    set status = 'reviewing', reviewed_by = actor_id, reviewed_at = review_time
    where id = p_request_id;
  end if;

  insert into public.account_deletion_events (
    request_id, user_id, actor_id, event_type, from_status, to_status, detail
  ) values (
    p_request_id, request_record.user_id, actor_id, 'disposition_reviewed',
    request_record.status, 'reviewing',
    jsonb_build_object('resource_key', p_resource_key, 'resolution', p_resolution,
      'note', clean_note, 'evidence', p_evidence,
      'irreversible', coalesce(p_irreversible, false))
  );

  return query select p_request_id, p_resource_key, p_resolution, review_time;
end;
$$;

create or replace function public.prevent_cancellation_after_irreversible_disposition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled'
     and old.status is distinct from 'cancelled'
     and exists (
       select 1 from public.account_deletion_dispositions d
       where d.request_id = new.id
         and d.irreversible = true
         and d.status = 'completed'
     ) then
    raise exception 'This deletion request has an irreversible completed disposition and cannot be cancelled.'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_cancellation_after_irreversible_disposition
on public.account_deletion_requests;
create trigger prevent_cancellation_after_irreversible_disposition
before update of status on public.account_deletion_requests
for each row
when (old.status is distinct from new.status)
execute function public.prevent_cancellation_after_irreversible_disposition();

create or replace function public.requeue_account_deletion_request(
  p_request_id uuid,
  p_reason text
)
returns table (request_id uuid, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  request_record public.account_deletion_requests%rowtype;
  clean_reason text := nullif(left(trim(coalesce(p_reason, '')), 2000), '');
begin
  if actor_id is null or not exists (
    select 1 from public.profiles p where p.id = actor_id and p.is_admin = true
  ) then
    raise exception 'Administrator access required.' using errcode = '42501';
  end if;
  if clean_reason is null or char_length(clean_reason) < 10 then
    raise exception 'A requeue reason of at least 10 characters is required.' using errcode = '22023';
  end if;

  select * into request_record
  from public.account_deletion_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'Deletion request not found.' using errcode = 'P0002';
  end if;
  if request_record.status not in ('reviewing', 'blocked', 'failed') then
    raise exception 'This deletion request cannot be requeued.' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.account_deletion_dispositions d
    where d.request_id = p_request_id and d.reviewed_at is not null
  ) then
    raise exception 'At least one reviewed disposition is required before requeue.' using errcode = '55000';
  end if;

  update public.account_deletion_requests
  set status = 'requested', last_error = null
  where id = p_request_id;

  insert into public.account_deletion_events (
    request_id, user_id, actor_id, event_type, from_status, to_status, detail
  ) values (
    p_request_id, request_record.user_id, actor_id, 'requeued',
    request_record.status, 'requested', jsonb_build_object('reason', clean_reason)
  );

  return query select p_request_id, 'requested'::text;
end;
$$;

revoke all on function public.review_account_deletion_disposition(uuid, text, text, text, jsonb, boolean) from public;
revoke all on function public.requeue_account_deletion_request(uuid, text) from public;
grant execute on function public.review_account_deletion_disposition(uuid, text, text, text, jsonb, boolean) to authenticated;
grant execute on function public.requeue_account_deletion_request(uuid, text) to authenticated;

comment on function public.review_account_deletion_disposition(uuid, text, text, text, jsonb, boolean) is
'Records an evidence-backed administrator outcome for a manual or external account deletion resource.';
comment on function public.requeue_account_deletion_request(uuid, text) is
'Requeues a reviewed blocked or failed deletion request for fail-closed processing.';
