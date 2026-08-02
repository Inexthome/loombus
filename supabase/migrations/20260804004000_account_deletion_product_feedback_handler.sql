-- Eighth automatic destructive account-deletion handler.
-- Runtime execution remains gated by ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED.

create or replace function public.delete_account_product_feedback_data(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_record public.account_deletion_requests%rowtype;
  affected integer;
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
    raise exception 'Account deletion request not found.' using errcode = 'P0002';
  end if;

  if request_record.status <> 'processing' then
    raise exception 'Account deletion request must be processing.' using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.profiles profile
    where profile.id = request_record.user_id
      and profile.account_status = 'deletion_requested'
  ) then
    raise exception 'Account must remain deletion_requested.' using errcode = '55000';
  end if;

  delete from public.labs_feature_request_votes
  where user_id = request_record.user_id;
  get diagnostics affected = row_count;
  deleted_rows := deleted_rows || jsonb_build_object('labs_feature_request_votes', affected);

  delete from public.ai_output_ratings
  where user_id = request_record.user_id;
  get diagnostics affected = row_count;
  deleted_rows := deleted_rows || jsonb_build_object('ai_output_ratings', affected);

  return jsonb_build_object(
    'handler', 'delete_product_feedback_data',
    'request_id', request_record.id,
    'user_id', request_record.user_id,
    'deleted_rows', deleted_rows,
    'verified_at', now()
  );
end;
$$;

revoke all on function public.delete_account_product_feedback_data(uuid) from public;
grant execute on function public.delete_account_product_feedback_data(uuid) to service_role;

insert into public.account_deletion_resource_registry (
  resource_key, data_class, system_of_record, disposition, handler_key,
  execution_mode, sort_order, detail
) values (
  'member_product_feedback',
  'Member-submitted product feedback metadata',
  'Supabase Database',
  'delete',
  'delete_product_feedback_data',
  'automatic',
  39,
  jsonb_build_object(
    'runtime_gate', 'ACCOUNT_DELETION_DESTRUCTIVE_HANDLERS_ENABLED',
    'transactional', true,
    'tables', jsonb_build_array('labs_feature_request_votes', 'ai_output_ratings'),
    'excludes', jsonb_build_array(
      'Labs feature requests', 'discussions', 'AI prompts', 'AI outputs',
      'AI provider copies', 'moderation evidence', 'vendor copies'
    )
  )
)
on conflict (resource_key) do update set
  data_class = excluded.data_class,
  system_of_record = excluded.system_of_record,
  disposition = excluded.disposition,
  handler_key = excluded.handler_key,
  execution_mode = excluded.execution_mode,
  enabled = true,
  sort_order = excluded.sort_order,
  detail = excluded.detail,
  updated_at = now();

comment on function public.delete_account_product_feedback_data(uuid) is
'Deletes member-submitted Labs votes and AI helpfulness ratings and returns per-table evidence. Service-role only.';
