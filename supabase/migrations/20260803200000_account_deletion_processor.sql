-- Account deletion processor orchestration
--
-- Adds an approved resource registry, concurrency-safe request claiming, and
-- database-enforced finalization. This phase intentionally performs no content
-- or Auth deletion. Unapproved resources are surfaced as manual-review
-- exceptions so a request cannot be reported as completed prematurely.

create table if not exists public.account_deletion_resource_registry (
  resource_key text primary key,
  data_class text not null,
  system_of_record text not null,
  disposition text not null,
  handler_key text not null,
  execution_mode text not null default 'manual_review',
  enabled boolean not null default true,
  sort_order integer not null default 100,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_deletion_registry_disposition_check check (disposition in (
    'delete', 'anonymize', 'retain', 'staged_delete', 'vendor_delete', 'manual_review'
  )),
  constraint account_deletion_registry_mode_check check (execution_mode in (
    'automatic', 'manual_review', 'external'
  ))
);

alter table public.account_deletion_resource_registry enable row level security;

drop policy if exists "Admins can read account deletion resource registry"
on public.account_deletion_resource_registry;
create policy "Admins can read account deletion resource registry"
on public.account_deletion_resource_registry for select to authenticated
using (exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
));

revoke all on table public.account_deletion_resource_registry from anon, authenticated;
grant select on table public.account_deletion_resource_registry to authenticated;
grant select on table public.account_deletion_resource_registry to service_role;

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values
  ('account_access', 'Account access restriction', 'Supabase public.profiles', 'retain', 'verify_account_restriction', 'automatic', 10,
   '{"completion_rule":"Profile must remain deletion_requested while the request is open."}'::jsonb),
  ('auth_identity', 'Account identity and authentication', 'Supabase Auth', 'manual_review', 'supabase_auth', 'manual_review', 20,
   '{"gap":"Auth deletion and minimum tombstone rules require approval."}'::jsonb),
  ('profile_and_preferences', 'Profile, settings, follows, blocks, and viewer records', 'Supabase Database', 'anonymize', 'profile_data', 'manual_review', 30,
   '{"gap":"Field-level anonymization and dependency map require approval."}'::jsonb),
  ('public_content', 'Discussions, Replies, drafts, metrics, summaries, and attachments', 'Supabase Database and Storage', 'manual_review', 'public_content', 'manual_review', 40,
   '{"gap":"Public-integrity and author-anonymization rules require approval."}'::jsonb),
  ('private_messages', 'Private messages and attachments', 'Supabase Database and Storage', 'delete', 'private_messages', 'manual_review', 50,
   '{"gap":"Participant access, reported evidence, and attachment rules require approval."}'::jsonb),
  ('rooms', 'Rooms, membership, files, calendars, governance, and lifecycle records', 'Supabase Database and Storage', 'staged_delete', 'rooms', 'manual_review', 60,
   '{"gap":"Ownership transfer, legal hold, billing, and staged-deletion rules require approval."}'::jsonb),
  ('commerce_and_local', 'Marketplace, Businesses, Services, Requests, Jobs, Events, Appointments, and Local', 'Supabase Database and Storage', 'manual_review', 'commerce_local', 'manual_review', 70,
   '{"gap":"Transactions, disputes, ownership, and module-specific rules require approval."}'::jsonb),
  ('search_and_cache', 'Search indexes, query logs, click logs, and caches', 'Supabase and application infrastructure', 'delete', 'search_cache', 'manual_review', 80,
   '{"gap":"Index propagation and cache expiration verification require approval."}'::jsonb),
  ('ai_data', 'AI prompts, outputs, summaries, traces, and provider copies', 'Supabase and AI providers', 'vendor_delete', 'ai_data', 'external', 90,
   '{"gap":"Provider deletion behavior and safety exceptions remain unverified."}'::jsonb),
  ('billing', 'Subscriptions, invoices, payments, and billing metadata', 'Stripe and Supabase', 'retain', 'billing', 'external', 100,
   '{"gap":"Required financial retention and optional metadata deletion require approval."}'::jsonb),
  ('notifications', 'Notifications, email events, and push tokens', 'Supabase and delivery providers', 'delete', 'notifications', 'manual_review', 110,
   '{"gap":"Delivery-provider retention and token cleanup verification require approval."}'::jsonb),
  ('trust_safety_support', 'Reports, enforcement, appeals, safety evidence, audit, security, and support', 'Supabase and infrastructure logs', 'retain', 'trust_safety_support', 'manual_review', 120,
   '{"gap":"Minimum evidence, legal hold, dispute, fraud, and security rules require approval."}'::jsonb),
  ('backups_and_replicas', 'Backups, replicas, caches, and vendor copies', 'Supabase, Vercel, and external processors', 'manual_review', 'backups_replicas', 'external', 130,
   '{"gap":"Expiration and deletion-verification behavior remain unverified."}'::jsonb)
on conflict (resource_key) do update set
  data_class = excluded.data_class,
  system_of_record = excluded.system_of_record,
  disposition = excluded.disposition,
  handler_key = excluded.handler_key,
  execution_mode = excluded.execution_mode,
  sort_order = excluded.sort_order,
  detail = excluded.detail,
  updated_at = now();

create or replace function public.claim_account_deletion_requests(p_limit integer default 10)
returns table (request_id uuid, user_id uuid, processing_attempts integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  return query
  with candidates as (
    select r.id
    from public.account_deletion_requests r
    where r.status in ('requested', 'failed')
    order by r.requested_at, r.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ), claimed as (
    update public.account_deletion_requests r
    set status = 'processing',
        processing_started_at = now(),
        processing_completed_at = null,
        processing_attempts = r.processing_attempts + 1,
        last_error = null
    from candidates c
    where r.id = c.id
    returning r.id, r.user_id, r.processing_attempts
  ), events as (
    insert into public.account_deletion_events (
      request_id, user_id, actor_id, event_type, from_status, to_status, detail
    )
    select c.id, c.user_id, null, 'processing_started', null, 'processing',
      jsonb_build_object('attempt', c.processing_attempts)
    from claimed c
  )
  select c.id, c.user_id, c.processing_attempts from claimed c;
end;
$$;

revoke all on function public.claim_account_deletion_requests(integer) from public;
grant execute on function public.claim_account_deletion_requests(integer) to service_role;

create or replace function public.finalize_account_deletion_request(p_request_id uuid)
returns table (request_id uuid, status text, pending_count integer, failed_count integer, exception_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_record public.account_deletion_requests%rowtype;
  pending_total integer;
  failed_total integer;
  exception_total integer;
  disposition_total integer;
  registry_total integer;
  next_status text;
  report jsonb;
  snapshot jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required.' using errcode = '42501';
  end if;

  select * into request_record
  from public.account_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Deletion request not found.' using errcode = 'P0002';
  end if;
  if request_record.status <> 'processing' then
    raise exception 'Deletion request is not processing.' using errcode = '55000';
  end if;

  select count(*) into registry_total
  from public.account_deletion_resource_registry where enabled = true;
  select count(*) into disposition_total
  from public.account_deletion_dispositions d
  join public.account_deletion_resource_registry r using (resource_key)
  where d.request_id = p_request_id and r.enabled = true;
  select count(*) into pending_total
  from public.account_deletion_dispositions d
  join public.account_deletion_resource_registry r using (resource_key)
  where d.request_id = p_request_id and r.enabled = true
    and d.status in ('pending', 'in_progress');
  select count(*) into failed_total
  from public.account_deletion_dispositions d
  join public.account_deletion_resource_registry r using (resource_key)
  where d.request_id = p_request_id and r.enabled = true and d.status = 'failed';
  select count(*) into exception_total
  from public.account_deletion_dispositions d
  join public.account_deletion_resource_registry r using (resource_key)
  where d.request_id = p_request_id and r.enabled = true and d.status = 'excepted';

  select coalesce(jsonb_agg(jsonb_build_object(
    'resource_key', d.resource_key,
    'data_class', d.data_class,
    'status', d.status,
    'disposition', d.disposition,
    'exception_code', d.exception_code,
    'detail', d.detail
  ) order by r.sort_order), '[]'::jsonb)
  into snapshot
  from public.account_deletion_dispositions d
  join public.account_deletion_resource_registry r using (resource_key)
  where d.request_id = p_request_id and r.enabled = true;

  select coalesce(jsonb_agg(item), '[]'::jsonb) into report
  from jsonb_array_elements(snapshot) item
  where item->>'status' in ('pending', 'in_progress', 'failed', 'excepted');

  if disposition_total <> registry_total or pending_total > 0 then
    next_status := 'blocked';
  elsif failed_total > 0 then
    next_status := 'failed';
  elsif exception_total > 0 then
    next_status := 'blocked';
  else
    next_status := 'completed';
  end if;

  update public.account_deletion_requests
  set status = next_status,
      processing_completed_at = case when next_status = 'completed' then now() else null end,
      last_error = case
        when next_status = 'failed' then 'One or more resource handlers failed.'
        when next_status = 'blocked' then 'Manual review or unresolved disposition required.'
        else null
      end,
      exception_report = report,
      disposition_snapshot = snapshot
  where id = p_request_id;

  insert into public.account_deletion_events (
    request_id, user_id, actor_id, event_type, from_status, to_status, detail
  ) values (
    p_request_id,
    request_record.user_id,
    null,
    case next_status
      when 'completed' then 'completed'
      when 'failed' then 'processing_failed'
      else 'processing_blocked'
    end,
    'processing',
    next_status,
    jsonb_build_object(
      'registered_resources', registry_total,
      'recorded_dispositions', disposition_total,
      'pending', pending_total,
      'failed', failed_total,
      'exceptions', exception_total
    )
  );

  return query select p_request_id, next_status, pending_total, failed_total, exception_total;
end;
$$;

revoke all on function public.finalize_account_deletion_request(uuid) from public;
grant execute on function public.finalize_account_deletion_request(uuid) to service_role;

comment on table public.account_deletion_resource_registry is
'Canonical executable resource groups for account deletion. Automatic execution requires explicit enablement and an implemented handler.';
