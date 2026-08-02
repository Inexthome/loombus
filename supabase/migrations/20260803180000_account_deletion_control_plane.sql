-- Account deletion control plane
--
-- Keeps request creation and account restriction atomic, records controlled
-- processing state, and prevents an account from being restored while an open
-- deletion request still exists.

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_status_check;

alter table public.account_deletion_requests
  add constraint account_deletion_requests_status_check
  check (status in (
    'requested', 'reviewing', 'processing', 'blocked', 'failed', 'completed', 'cancelled'
  ));

drop index if exists public.account_deletion_requests_open_user_idx;
create unique index account_deletion_requests_open_user_idx
on public.account_deletion_requests(user_id)
where status in ('requested', 'reviewing', 'processing', 'blocked', 'failed');

alter table public.account_deletion_requests
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_completed_at timestamptz,
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists exception_report jsonb not null default '[]'::jsonb,
  add column if not exists disposition_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_processing_attempts_check;
alter table public.account_deletion_requests
  add constraint account_deletion_requests_processing_attempts_check
  check (processing_attempts >= 0);

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_requests_cancellation_reason_length;
alter table public.account_deletion_requests
  add constraint account_deletion_requests_cancellation_reason_length
  check (cancellation_reason is null or char_length(trim(cancellation_reason)) between 1 and 2000);

create table if not exists public.account_deletion_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.account_deletion_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint account_deletion_events_type_check check (event_type in (
    'requested', 'review_started', 'processing_started', 'processing_blocked',
    'processing_failed', 'completed', 'cancelled'
  ))
);

create index if not exists account_deletion_events_request_created_idx
on public.account_deletion_events(request_id, created_at);

create table if not exists public.account_deletion_dispositions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.account_deletion_requests(id) on delete cascade,
  resource_key text not null,
  data_class text not null,
  system_of_record text not null,
  disposition text not null,
  status text not null default 'pending',
  exception_code text,
  detail jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_deletion_dispositions_unique_resource unique (request_id, resource_key),
  constraint account_deletion_dispositions_disposition_check check (disposition in (
    'delete', 'anonymize', 'retain', 'staged_delete', 'vendor_delete', 'manual_review'
  )),
  constraint account_deletion_dispositions_status_check check (status in (
    'pending', 'in_progress', 'completed', 'excepted', 'failed', 'not_applicable'
  ))
);

alter table public.account_deletion_events enable row level security;
alter table public.account_deletion_dispositions enable row level security;

create policy "Users can read own account deletion events"
on public.account_deletion_events for select to authenticated
using (user_id = auth.uid());

create policy "Admins can read account deletion events"
on public.account_deletion_events for select to authenticated
using (exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
));

create policy "Admins can read account deletion dispositions"
on public.account_deletion_dispositions for select to authenticated
using (exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
));

create or replace function public.request_account_deletion(p_reason text default null)
returns table (request_id uuid, requested_at timestamptz, previous_account_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  profile_record public.profiles%rowtype;
  created_request public.account_deletion_requests%rowtype;
  clean_reason text := nullif(left(trim(coalesce(p_reason, '')), 2000), '');
begin
  if actor_id is null then
    raise exception 'Unauthorized.' using errcode = '42501';
  end if;

  select * into profile_record
  from public.profiles
  where id = actor_id
  for update;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  if profile_record.is_admin = true and not exists (
    select 1 from public.profiles p where p.is_admin = true and p.id <> actor_id
  ) then
    raise exception 'You cannot request deletion for the only admin account.' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.account_deletion_requests r
    where r.user_id = actor_id and r.status in ('requested', 'reviewing', 'processing', 'blocked', 'failed')
  ) then
    raise exception 'You already have an open account deletion request.' using errcode = '23505';
  end if;

  insert into public.account_deletion_requests (user_id, reason, status)
  values (actor_id, clean_reason, 'requested')
  returning * into created_request;

  update public.profiles
  set account_status = 'deletion_requested',
      enforcement_reason = 'Self-requested account deletion',
      enforcement_note = clean_reason,
      enforced_by = actor_id,
      enforced_at = now(),
      suspended_until = null
  where id = actor_id;

  insert into public.account_deletion_events (
    request_id, user_id, actor_id, event_type, from_status, to_status, detail
  ) values (
    created_request.id, actor_id, actor_id, 'requested', null, 'requested',
    jsonb_build_object('previous_account_status', profile_record.account_status, 'self_service', true)
  );

  return query select created_request.id, created_request.requested_at, profile_record.account_status;
end;
$$;

revoke all on function public.request_account_deletion(text) from public;
grant execute on function public.request_account_deletion(text) to authenticated;

create or replace function public.cancel_account_deletion_request(
  p_request_id uuid,
  p_reason text
)
returns table (request_id uuid, cancelled_at timestamptz, account_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  request_record public.account_deletion_requests%rowtype;
  clean_reason text := nullif(left(trim(coalesce(p_reason, '')), 2000), '');
  actor_is_admin boolean := false;
  cancellation_time timestamptz := now();
begin
  if actor_id is null then
    raise exception 'Unauthorized.' using errcode = '42501';
  end if;
  if clean_reason is null then
    raise exception 'A cancellation reason is required.' using errcode = '22023';
  end if;

  select coalesce(is_admin, false) into actor_is_admin
  from public.profiles where id = actor_id;

  select * into request_record
  from public.account_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Deletion request not found.' using errcode = 'P0002';
  end if;
  if request_record.user_id <> actor_id and not actor_is_admin then
    raise exception 'Forbidden.' using errcode = '42501';
  end if;
  if request_record.status not in ('requested', 'reviewing', 'blocked', 'failed') then
    raise exception 'This deletion request cannot be cancelled in its current state.' using errcode = '55000';
  end if;

  update public.account_deletion_requests
  set status = 'cancelled',
      cancelled_by = actor_id,
      cancelled_at = cancellation_time,
      cancellation_reason = clean_reason,
      reviewed_by = coalesce(reviewed_by, case when actor_is_admin then actor_id else null end),
      reviewed_at = coalesce(reviewed_at, case when actor_is_admin then cancellation_time else null end)
  where id = p_request_id;

  insert into public.account_deletion_events (
    request_id, user_id, actor_id, event_type, from_status, to_status, detail
  ) values (
    p_request_id, request_record.user_id, actor_id, 'cancelled', request_record.status, 'cancelled',
    jsonb_build_object('reason', clean_reason, 'actor_is_admin', actor_is_admin)
  );

  update public.profiles
  set account_status = 'active',
      enforcement_reason = null,
      enforcement_note = null,
      enforced_by = actor_id,
      enforced_at = cancellation_time,
      suspended_until = null
  where id = request_record.user_id and account_status = 'deletion_requested';

  return query select p_request_id, cancellation_time, p.account_status
  from public.profiles p where p.id = request_record.user_id;
end;
$$;

revoke all on function public.cancel_account_deletion_request(uuid, text) from public;
grant execute on function public.cancel_account_deletion_request(uuid, text) to authenticated;

create or replace function public.prevent_uncancelled_account_deletion_restoration()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.account_status = 'deletion_requested'
     and new.account_status is distinct from 'deletion_requested'
     and exists (
       select 1 from public.account_deletion_requests r
       where r.user_id = new.id
         and r.status in ('requested', 'reviewing', 'processing', 'blocked', 'failed')
     ) then
    raise exception 'Cancel the open account deletion request before restoring or changing this account.'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_uncancelled_account_deletion_restoration on public.profiles;
create trigger prevent_uncancelled_account_deletion_restoration
before update of account_status on public.profiles
for each row
when (old.account_status is distinct from new.account_status)
execute function public.prevent_uncancelled_account_deletion_restoration();

comment on table public.account_deletion_events is
'Append-only workflow audit trail for account deletion requests.';
comment on table public.account_deletion_dispositions is
'Per-resource deletion, anonymization, retention, staged-deletion, vendor, or review result for an account deletion request.';
