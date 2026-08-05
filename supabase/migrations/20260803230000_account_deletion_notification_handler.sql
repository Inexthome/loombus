-- First automatic destructive account-deletion handler.
-- Runtime execution remains gated by ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED.

create or replace function public.delete_account_notification_data(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_record public.account_deletion_requests%rowtype;
  table_name text;
  deleted_count bigint;
  deleted_rows jsonb := '{}'::jsonb;
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
    raise exception 'Deletion request must be processing.' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = request_record.user_id
      and p.account_status = 'deletion_requested'
  ) then
    raise exception 'Account restriction is not active.' using errcode = '55000';
  end if;

  foreach table_name in array array[
    'notifications',
    'notification_preferences',
    'user_topic_alerts',
    'room_notification_preferences',
    'user_push_device_tokens'
  ] loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('delete from public.%I where user_id = $1', table_name)
      using request_record.user_id;
      get diagnostics deleted_count = row_count;
      deleted_rows := deleted_rows || jsonb_build_object(table_name, deleted_count);
    else
      deleted_rows := deleted_rows || jsonb_build_object(table_name, 'not_present');
    end if;
  end loop;

  return jsonb_build_object(
    'handler', 'delete_first_party_notifications',
    'request_id', request_record.id,
    'user_id', request_record.user_id,
    'executed_at', now(),
    'deleted_rows', deleted_rows
  );
end;
$$;

revoke all on function public.delete_account_notification_data(uuid) from public;
grant execute on function public.delete_account_notification_data(uuid) to service_role;

update public.account_deletion_resource_registry
set data_class = 'First-party notifications, preferences, topic alerts, and push tokens',
    system_of_record = 'Supabase Database',
    disposition = 'delete',
    handler_key = 'delete_first_party_notifications',
    execution_mode = 'automatic',
    detail = jsonb_build_object(
      'runtime_gate', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED',
      'tables', jsonb_build_array(
        'notifications', 'notification_preferences', 'user_topic_alerts',
        'room_notification_preferences', 'user_push_device_tokens'
      ),
      'completion_rule', 'RPC returns per-table deletion counts while the request is processing and the account remains restricted.'
    ),
    updated_at = now()
where resource_key = 'notifications';

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'notification_delivery_vendors',
  'Email and push delivery-provider records',
  'Email and push delivery providers',
  'vendor_delete',
  'notification_delivery_vendors',
  'external',
  115,
  '{"gap":"Provider deletion and retention behavior requires external verification."}'::jsonb
)
on conflict (resource_key) do update set
  data_class = excluded.data_class,
  system_of_record = excluded.system_of_record,
  disposition = excluded.disposition,
  handler_key = excluded.handler_key,
  execution_mode = excluded.execution_mode,
  sort_order = excluded.sort_order,
  detail = excluded.detail,
  enabled = true,
  updated_at = now();

comment on function public.delete_account_notification_data(uuid) is
'Deletes member-addressable first-party notification data and returns per-table evidence. Service-role only.';
