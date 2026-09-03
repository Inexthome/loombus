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
      )
      returning id into item_id;
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
      select p.id, 'admin_attention', p_source_type, p_source_id, notification_message
      from public.profiles p
      where p.is_admin = true;
    end if;
  else
    if found and existing_row.resolved_at is null then
      update public.admin_attention_items
      set source_status = nullif(p_source_status, ''),
          source_updated_at = p_source_updated_at,
          resolved_at = now(),
          updated_at = now()
      where id = existing_row.id;
      item_id := existing_row.id;
    elsif found then
      item_id := existing_row.id;
    end if;
  end if;

  return item_id;
end;
$$;

revoke all on function public.sync_admin_attention_item(text, text, boolean, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.sync_admin_attention_item(text, text, boolean, text, text, text, text, text, timestamptz) to service_role;

create or replace function public.sync_admin_attention_from_source()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  record_json jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
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
  if tg_op = 'DELETE' then
    source_id := coalesce(record_json->>'id', record_json->>'publication_id');
  end if;

  case tg_table_name
    when 'reports' then
      source_type := 'admin_report';
      source_id := coalesce(source_id, record_json->>'id');
      source_status := record_json->>'status';
      actionable := tg_op <> 'DELETE' and source_status in ('new', 'reviewing');
      title_text := 'Member report needs review';
      summary_text := coalesce(record_json->>'reason', record_json->>'details');
      action_url_text := '/admin/reports?report=' || source_id;
      priority_text := 'high';
    when 'support_requests' then
      source_type := 'admin_support_request';
      source_id := coalesce(source_id, record_json->>'id');
      source_status := record_json->>'status';
      actionable := tg_op <> 'DELETE' and source_status in ('new', 'reviewing');
      title_text := coalesce(nullif(record_json->>'subject', ''), 'Support request needs review');
      summary_text := record_json->>'message';
      action_url_text := '/admin/support?request=' || source_id;
    when 'labs_feature_requests' then
      source_type := 'admin_labs_request';
      source_id := coalesce(source_id, record_json->>'id');
      source_status := record_json->>'status';
      actionable := tg_op <> 'DELETE' and source_status in ('submitted', 'reviewing');
      title_text := coalesce(nullif(record_json->>'title', ''), 'Labs request needs review');
      summary_text := record_json->>'description';
      action_url_text := '/admin/labs?request=' || source_id;
    when 'library_author_publications' then
      source_type := 'admin_library_review';
      source_id := coalesce(source_id, record_json->>'publication_id');
      source_status := record_json->>'submission_status';
      actionable := tg_op <> 'DELETE' and (
        source_status = 'submitted'
        or (source_status = 'approved' and nullif(record_json->>'published_at', '') is null)
      );
      title_text := case when source_status = 'approved'
        then 'Approved Library publication is ready to publish'
        else 'Library publication needs review'
      end;
      summary_text := record_json->>'review_note';
      action_url_text := '/admin/library-review?publication=' || source_id;
      priority_text := 'high';
    when 'professional_booking_payment_disputes' then
      source_type := 'admin_booking_dispute';
      source_id := coalesce(source_id, record_json->>'id');
      source_status := record_json->>'status';
      actionable := tg_op <> 'DELETE' and nullif(record_json->>'resolved_at', '') is null;
      title_text := 'Professional Booking dispute needs review';
      summary_text := coalesce(record_json->>'reason', source_status);
      action_url_text := '/admin/professional-booking/payments?dispute=' || source_id;
      priority_text := case when coalesce((record_json->>'evidence_past_due')::boolean, false) then 'urgent' else 'high' end;
    when 'account_deletion_requests' then
      source_type := 'admin_account_deletion';
      source_id := coalesce(source_id, record_json->>'id');
      source_status := record_json->>'status';
      actionable := tg_op <> 'DELETE' and source_status in ('reviewing', 'blocked', 'failed');
      title_text := 'Account deletion request needs Admin review';
      summary_text := record_json->>'last_error';
      action_url_text := '/admin/legal-operations?deletion_request=' || source_id;
      priority_text := 'high';
    when 'trust_safety_cases' then
      source_type := 'admin_trust_safety_case';
      source_id := coalesce(source_id, record_json->>'id');
      source_status := record_json->>'status';
      actionable := tg_op <> 'DELETE'
        and source_status <> 'closed'
        and coalesce(record_json->>'source_type', 'manual') <> 'manual';
      title_text := coalesce(nullif(record_json->>'case_number', ''), 'Trust & Safety case') || ' needs review';
      summary_text := record_json->>'summary';
      action_url_text := '/admin/legal-operations?trust_safety_case=' || source_id;
      priority_text := case record_json->>'severity' when 'S1' then 'urgent' when 'S2' then 'high' else 'normal' end;
    when 'profiles' then
      source_type := 'admin_identity_review';
      source_id := coalesce(source_id, record_json->>'id');
      source_status := record_json->>'identity_verification_status';
      actionable := tg_op <> 'DELETE' and source_status = 'pending';
      title_text := 'Identity verification needs Admin review';
      summary_text := record_json->>'identity_restriction_reason';
      action_url_text := '/admin/users?member=' || source_id;
      priority_text := 'high';
    else
      return case when tg_op = 'DELETE' then old else new end;
  end case;

  begin
    source_updated := nullif(coalesce(record_json->>'updated_at', record_json->>'reviewed_at', record_json->>'created_at'), '')::timestamptz;
  exception when others then
    source_updated := null;
  end;

  perform public.sync_admin_attention_item(
    source_type, source_id, actionable, source_status,
    title_text, summary_text, action_url_text, priority_text, source_updated
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

-- Backfill only currently actionable source records. Existing unresolved source state
-- becomes the durable queue without producing duplicate rows.
select public.sync_admin_attention_item(
  'admin_report', id::text, true, status,
  'Member report needs review', coalesce(reason, details),
  '/admin/reports?report=' || id::text, 'high', created_at
) from public.reports where status in ('new', 'reviewing');

select public.sync_admin_attention_item(
  'admin_support_request', id::text, true, status,
  coalesce(nullif(subject, ''), 'Support request needs review'), message,
  '/admin/support?request=' || id::text, 'normal', updated_at
) from public.support_requests where status in ('new', 'reviewing');

select public.sync_admin_attention_item(
  'admin_labs_request', id::text, true, status,
  coalesce(nullif(title, ''), 'Labs request needs review'), description,
  '/admin/labs?request=' || id::text, 'normal', updated_at
) from public.labs_feature_requests where status in ('submitted', 'reviewing');

select public.sync_admin_attention_item(
  'admin_library_review', publication_id::text, true, submission_status,
  case when submission_status = 'approved'
    then 'Approved Library publication is ready to publish'
    else 'Library publication needs review'
  end,
  review_note,
  '/admin/library-review?publication=' || publication_id::text,
  'high', coalesce(reviewed_at, submitted_at)
) from public.library_author_publications
where submission_status = 'submitted'
   or (submission_status = 'approved' and published_at is null);

select public.sync_admin_attention_item(
  'admin_booking_dispute', id::text, true, status,
  'Professional Booking dispute needs review', coalesce(reason, status),
  '/admin/professional-booking/payments?dispute=' || id::text,
  case when coalesce(evidence_past_due, false) then 'urgent' else 'high' end,
  coalesce(last_synced_at, stripe_created_at)
) from public.professional_booking_payment_disputes
where resolved_at is null;

select public.sync_admin_attention_item(
  'admin_account_deletion', id::text, true, status,
  'Account deletion request needs Admin review', last_error,
  '/admin/legal-operations?deletion_request=' || id::text,
  'high', created_at
) from public.account_deletion_requests
where status in ('reviewing', 'blocked', 'failed');

select public.sync_admin_attention_item(
  'admin_trust_safety_case', id::text, true, status,
  case_number || ' needs review', summary,
  '/admin/legal-operations?trust_safety_case=' || id::text,
  case severity when 'S1' then 'urgent' when 'S2' then 'high' else 'normal' end,
  updated_at
) from public.trust_safety_cases
where status <> 'closed' and source_type <> 'manual';

select public.sync_admin_attention_item(
  'admin_identity_review', id::text, true, identity_verification_status,
  'Identity verification needs Admin review', identity_restriction_reason,
  '/admin/users?member=' || id::text,
  'high', identity_verified_at
) from public.profiles
where identity_verification_status = 'pending';

comment on table public.admin_attention_items is
  'Durable source-linked Admin Needs Attention queue. The source record is authoritative; unresolved items cannot be independently dismissed.';
comment on function public.sync_admin_attention_item(text, text, boolean, text, text, text, text, text, timestamptz) is
  'Opens, updates, resolves, or reopens one Admin attention item and notifies every Loombus admin only on initial open or reopen.';

notify pgrst, 'reload schema';
commit;
