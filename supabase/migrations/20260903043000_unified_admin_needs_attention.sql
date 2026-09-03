-- Durable, source-linked Admin Needs Attention queue.
-- Source records remain authoritative. Attention rows cannot be independently dismissed.

begin;

create table if not exists public.admin_attention_items (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  source_status text,
  title text not null,
  summary text,
  action_url text not null,
  priority text not null default 'normal',
  generation integer not null default 1,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  last_notified_at timestamptz,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_attention_items_source_unique unique (source_type, source_id),
  constraint admin_attention_items_priority_check check (priority in ('normal', 'high', 'urgent')),
  constraint admin_attention_items_generation_check check (generation >= 1),
  constraint admin_attention_items_action_url_check check (action_url like '/admin/%')
);

create index if not exists admin_attention_items_open_idx
  on public.admin_attention_items (resolved_at, priority, opened_at desc);
create index if not exists admin_attention_items_source_idx
  on public.admin_attention_items (source_type, source_id);

alter table public.admin_attention_items enable row level security;

revoke all on table public.admin_attention_items from public, anon, authenticated;
grant select on table public.admin_attention_items to authenticated;
grant select, insert, update, delete on table public.admin_attention_items to service_role;

drop policy if exists "Loombus admins can read attention items" on public.admin_attention_items;
create policy "Loombus admins can read attention items"
  on public.admin_attention_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
  );

create or replace function public.sync_admin_attention_item(
  p_source_type text,
  p_source_id text,
  p_actionable boolean,
  p_source_status text,
  p_title text,
  p_summary text,
  p_action_url text,
  p_priority text default 'normal',
  p_source_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_row public.admin_attention_items%rowtype;
  item_id uuid;
  should_notify boolean := false;
  notification_message text;
begin
  if nullif(trim(coalesce(p_source_type, '')), '') is null
     or nullif(trim(coalesce(p_source_id, '')), '') is null then
    raise exception 'Admin attention source type and source id are required.' using errcode = '22023';
  end if;

  select * into existing_row
  from public.admin_attention_items
  where source_type = p_source_type and source_id = p_source_id
  for update;

  if p_actionable then
    if not found then
      insert into public.admin_attention_items (
        source_type, source_id, source_status, title, summary, action_url,
        priority, source_updated_at, last_notified_at
      ) values (
        p_source_type,
        p_source_id,
        nullif(p_source_status, ''),
        left(coalesce(nullif(trim(p_title), ''), 'Admin action required'), 240),
        nullif(left(coalesce(p_summary, ''), 2000), ''),
        p_action_url,
        case when p_priority in ('normal', 'high', 'urgent') then p_priority else 'normal' end,
        p_source_updated_at,
        now()
      ) returning id into item_id;
      should_notify := true;
    else
      item_id := existing_row.id;
      should_notify := existing_row.resolved_at is not null;

      update public.admin_attention_items
      set source_status = nullif(p_source_status, ''),
          title = left(coalesce(nullif(trim(p_title), ''), title), 240),
          summary = nullif(left(coalesce(p_summary, ''), 2000), ''),
          action_url = p_action_url,
          priority = case when p_priority in ('normal', 'high', 'urgent') then p_priority else priority end,
          source_updated_at = p_source_updated_at,
          resolved_at = null,
          opened_at = case when existing_row.resolved_at is not null then now() else opened_at end,
          generation = case when existing_row.resolved_at is not null then generation + 1 else generation end,
          last_notified_at = case when existing_row.resolved_at is not null then now() else last_notified_at end,
          updated_at = now()
      where id = existing_row.id;
    end if;

    if should_notify then
      notification_message := left(coalesce(nullif(trim(p_title), ''), 'Admin action required'), 500);
      insert into public.notifications (user_id, type, target_type, target_id, message)
      select p.id, 'admin_attention', p_source_type, item_id, notification_message
      from public.profiles p
      where p.is_admin = true;
    end if;
  elsif found then
    item_id := existing_row.id;
    if existing_row.resolved_at is null then
      update public.admin_attention_items
      set source_status = nullif(p_source_status, ''),
          source_updated_at = p_source_updated_at,
          resolved_at = now(),
          updated_at = now()
      where id = existing_row.id;
    end if;
  end if;

  return item_id;
end;
$$;

revoke all on function public.sync_admin_attention_item(text, text, boolean, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.sync_admin_attention_item(text, text, boolean, text, text, text, text, text, timestamptz) to service_role;

create or replace function public.sync_admin_attention_payload(
  p_table_name text,
  p_record jsonb,
  p_deleted boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_type text;
  source_id text;
  source_status text;
  title_text text;
  summary_text text;
  action_url_text text;
  priority_text text := 'normal';
  actionable boolean := false;
  source_updated timestamptz;
begin
  case p_table_name
    when 'reports' then
      source_type := 'admin_report';
      source_id := p_record->>'id';
      source_status := p_record->>'status';
      actionable := not p_deleted and source_status in ('new', 'reviewing');
      title_text := 'Member report needs review';
      summary_text := p_record->>'reason';
      action_url_text := '/admin/reports?report=' || source_id;
      priority_text := 'high';

    when 'support_requests' then
      source_type := 'admin_support_request';
      source_id := p_record->>'id';
      source_status := p_record->>'status';
      actionable := not p_deleted and source_status in ('new', 'reviewing');
      title_text := coalesce(nullif(p_record->>'subject', ''), 'Support request needs review');
      summary_text := p_record->>'message';
      action_url_text := '/admin/support?request=' || source_id;

    when 'labs_feature_requests' then
      source_type := 'admin_labs_request';
      source_id := p_record->>'id';
      source_status := p_record->>'status';
      actionable := not p_deleted and source_status in ('submitted', 'reviewing');
      title_text := coalesce(nullif(p_record->>'title', ''), 'Labs request needs review');
      summary_text := p_record->>'description';
      action_url_text := '/admin/labs?request=' || source_id;

    when 'library_author_publications' then
      source_type := 'admin_library_review';
      source_id := coalesce(p_record->>'publication_id', p_record->>'id');
      source_status := p_record->>'submission_status';
      actionable := not p_deleted and (
        source_status = 'submitted'
        or (source_status = 'approved' and nullif(p_record->>'published_at', '') is null)
      );
      title_text := case when source_status = 'approved'
        then 'Approved Library publication is ready to publish'
        else 'Library publication needs review'
      end;
      summary_text := p_record->>'review_note';
      action_url_text := '/admin/library-review?publication=' || source_id;
      priority_text := 'high';

    when 'professional_booking_payment_disputes' then
      source_type := 'admin_booking_dispute';
      source_id := p_record->>'id';
      source_status := p_record->>'status';
      actionable := not p_deleted and nullif(p_record->>'resolved_at', '') is null;
      title_text := 'Professional Booking dispute needs review';
      summary_text := coalesce(p_record->>'reason', source_status);
      action_url_text := '/admin/professional-booking/payments?dispute=' || source_id;
      priority_text := case when coalesce((p_record->>'evidence_past_due')::boolean, false) then 'urgent' else 'high' end;

    when 'account_deletion_requests' then
      source_type := 'admin_account_deletion';
      source_id := p_record->>'id';
      source_status := p_record->>'status';
      actionable := not p_deleted and source_status in ('reviewing', 'blocked', 'failed');
      title_text := 'Account deletion request needs Admin review';
      summary_text := p_record->>'last_error';
      action_url_text := '/admin/legal-operations?deletion_request=' || source_id;
      priority_text := 'high';

    when 'trust_safety_cases' then
      source_type := 'admin_trust_safety_case';
      source_id := p_record->>'id';
      source_status := p_record->>'status';
      actionable := not p_deleted
        and source_status <> 'closed'
        and coalesce(p_record->>'source_type', 'manual') <> 'manual';
      title_text := coalesce(nullif(p_record->>'case_number', ''), 'Trust & Safety case') || ' needs review';
      summary_text := p_record->>'summary';
      action_url_text := '/admin/legal-operations?trust_safety_case=' || source_id;
      priority_text := case p_record->>'severity' when 'S1' then 'urgent' when 'S2' then 'high' else 'normal' end;

    when 'profiles' then
      source_type := 'admin_identity_review';
      source_id := p_record->>'id';
      source_status := p_record->>'identity_verification_status';
      actionable := not p_deleted and source_status = 'pending';
      title_text := 'Identity verification needs Admin review';
      summary_text := p_record->>'identity_restriction_reason';
      action_url_text := '/admin/users?member=' || source_id;
      priority_text := 'high';

    else
      return;
  end case;

  begin
    source_updated := nullif(coalesce(
      p_record->>'updated_at',
      p_record->>'reviewed_at',
      p_record->>'created_at',
      p_record->>'requested_at',
      p_record->>'submitted_at'
    ), '')::timestamptz;
  exception when others then
    source_updated := null;
  end;

  perform public.sync_admin_attention_item(
    source_type,
    source_id,
    actionable,
    source_status,
    title_text,
    summary_text,
    action_url_text,
    priority_text,
    source_updated
  );
end;
$$;

revoke all on function public.sync_admin_attention_payload(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.sync_admin_attention_payload(text, jsonb, boolean) to service_role;

create or replace function public.sync_admin_attention_from_source()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.sync_admin_attention_payload(
    tg_table_name,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end,
    tg_op = 'DELETE'
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.sync_admin_attention_from_source() from public, anon, authenticated;
grant execute on function public.sync_admin_attention_from_source() to service_role;

-- Source-linked lifecycle triggers. Resolution is driven only by the source record.
drop trigger if exists reports_sync_admin_attention on public.reports;
create trigger reports_sync_admin_attention after insert or update or delete on public.reports
for each row execute function public.sync_admin_attention_from_source();

drop trigger if exists support_requests_sync_admin_attention on public.support_requests;
create trigger support_requests_sync_admin_attention after insert or update or delete on public.support_requests
for each row execute function public.sync_admin_attention_from_source();

drop trigger if exists labs_requests_sync_admin_attention on public.labs_feature_requests;
create trigger labs_requests_sync_admin_attention after insert or update or delete on public.labs_feature_requests
for each row execute function public.sync_admin_attention_from_source();

drop trigger if exists library_author_publications_sync_admin_attention on public.library_author_publications;
create trigger library_author_publications_sync_admin_attention after insert or update or delete on public.library_author_publications
for each row execute function public.sync_admin_attention_from_source();

drop trigger if exists booking_disputes_sync_admin_attention on public.professional_booking_payment_disputes;
create trigger booking_disputes_sync_admin_attention after insert or update or delete on public.professional_booking_payment_disputes
for each row execute function public.sync_admin_attention_from_source();

drop trigger if exists account_deletion_sync_admin_attention on public.account_deletion_requests;
create trigger account_deletion_sync_admin_attention after insert or update or delete on public.account_deletion_requests
for each row execute function public.sync_admin_attention_from_source();

drop trigger if exists trust_safety_cases_sync_admin_attention on public.trust_safety_cases;
create trigger trust_safety_cases_sync_admin_attention after insert or update or delete on public.trust_safety_cases
for each row execute function public.sync_admin_attention_from_source();

drop trigger if exists profiles_identity_sync_admin_attention on public.profiles;
create trigger profiles_identity_sync_admin_attention
after insert or update of identity_verification_status, identity_restriction_reason on public.profiles
for each row execute function public.sync_admin_attention_from_source();

-- Backfill currently unresolved actionable sources using JSON payloads so replay remains
-- resilient to source-specific timestamp/detail column differences.
do $$
declare
  r record;
begin
  for r in select to_jsonb(t) as payload from public.reports t loop
    if r.payload->>'status' in ('new', 'reviewing') then
      perform public.sync_admin_attention_payload('reports', r.payload, false);
    end if;
  end loop;

  for r in select to_jsonb(t) as payload from public.support_requests t loop
    if r.payload->>'status' in ('new', 'reviewing') then
      perform public.sync_admin_attention_payload('support_requests', r.payload, false);
    end if;
  end loop;

  for r in select to_jsonb(t) as payload from public.labs_feature_requests t loop
    if r.payload->>'status' in ('submitted', 'reviewing') then
      perform public.sync_admin_attention_payload('labs_feature_requests', r.payload, false);
    end if;
  end loop;

  for r in select to_jsonb(t) as payload from public.library_author_publications t loop
    if r.payload->>'submission_status' = 'submitted'
       or (r.payload->>'submission_status' = 'approved' and nullif(r.payload->>'published_at', '') is null) then
      perform public.sync_admin_attention_payload('library_author_publications', r.payload, false);
    end if;
  end loop;

  for r in select to_jsonb(t) as payload from public.professional_booking_payment_disputes t loop
    if nullif(r.payload->>'resolved_at', '') is null then
      perform public.sync_admin_attention_payload('professional_booking_payment_disputes', r.payload, false);
    end if;
  end loop;

  for r in select to_jsonb(t) as payload from public.account_deletion_requests t loop
    if r.payload->>'status' in ('reviewing', 'blocked', 'failed') then
      perform public.sync_admin_attention_payload('account_deletion_requests', r.payload, false);
    end if;
  end loop;

  for r in select to_jsonb(t) as payload from public.trust_safety_cases t loop
    if r.payload->>'status' <> 'closed'
       and coalesce(r.payload->>'source_type', 'manual') <> 'manual' then
      perform public.sync_admin_attention_payload('trust_safety_cases', r.payload, false);
    end if;
  end loop;

  for r in select to_jsonb(t) as payload from public.profiles t loop
    if r.payload->>'identity_verification_status' = 'pending' then
      perform public.sync_admin_attention_payload('profiles', r.payload, false);
    end if;
  end loop;
end;
$$;

comment on table public.admin_attention_items is
  'Durable source-linked Admin Needs Attention queue. The source record is authoritative; unresolved items cannot be independently dismissed.';
comment on function public.sync_admin_attention_item(text, text, boolean, text, text, text, text, text, timestamptz) is
  'Opens, updates, resolves, or reopens one Admin attention item and notifies every Loombus admin only on initial open or reopen.';

notify pgrst, 'reload schema';
commit;