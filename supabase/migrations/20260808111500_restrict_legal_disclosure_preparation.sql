-- Issue #674: disclosure preparation controls.
-- This phase permits draft disclosure metadata and least-data manifest preparation only.
-- It does not generate exports, approve disclosures or emergencies, send member notices,
-- or transmit data to any external recipient.

begin;

-- Remove direct mutation privileges from the service role so application code cannot
-- bypass the preparation-only RPC boundary. Read access remains available for the
-- restricted Legal Operations workspace.
revoke insert, update on table public.legal_disclosures from service_role;
revoke insert on table public.legal_disclosure_items from service_role;

create or replace function public.legal_create_disclosure_draft(
  p_request_id uuid,
  p_disclosure_type text,
  p_legal_basis_summary text,
  p_scope_summary text,
  p_recipient_organization text,
  p_recipient_contact_ref text,
  p_member_notice_decision text,
  p_delayed_notice_basis text,
  p_actor_id uuid
)
returns public.legal_disclosures
language plpgsql
security definer
set search_path = public
as $$
declare
  disclosure_row public.legal_disclosures;
begin
  if not exists (
    select 1
    from public.legal_requests request_row
    where request_row.id = p_request_id
  ) then
    raise exception 'Legal request not found.' using errcode = '22023';
  end if;

  insert into public.legal_disclosures (
    request_id,
    disclosure_type,
    status,
    legal_basis_summary,
    scope_summary,
    recipient_organization,
    recipient_contact_ref,
    member_notice_decision,
    delayed_notice_basis,
    manifest_sha256,
    approved_by,
    approved_at,
    transmitted_by,
    transmitted_at,
    created_by,
    updated_by
  ) values (
    p_request_id,
    p_disclosure_type,
    'draft',
    p_legal_basis_summary,
    p_scope_summary,
    p_recipient_organization,
    p_recipient_contact_ref,
    p_member_notice_decision,
    p_delayed_notice_basis,
    null,
    null,
    null,
    null,
    null,
    p_actor_id,
    p_actor_id
  )
  returning * into disclosure_row;

  return disclosure_row;
end;
$$;

create or replace function public.legal_update_disclosure_draft(
  p_request_id uuid,
  p_disclosure_id uuid,
  p_disclosure_type text,
  p_legal_basis_summary text,
  p_scope_summary text,
  p_recipient_organization text,
  p_recipient_contact_ref text,
  p_member_notice_decision text,
  p_delayed_notice_basis text,
  p_actor_id uuid
)
returns public.legal_disclosures
language plpgsql
security definer
set search_path = public
as $$
declare
  disclosure_row public.legal_disclosures;
begin
  select *
  into disclosure_row
  from public.legal_disclosures disclosure
  where disclosure.id = p_disclosure_id
    and disclosure.request_id = p_request_id
  for update;

  if not found then
    raise exception 'Disclosure draft not found.' using errcode = '22023';
  end if;

  if disclosure_row.status <> 'draft' then
    raise exception 'Only draft disclosure metadata may be edited in this phase.' using errcode = '42501';
  end if;

  update public.legal_disclosures
  set
    disclosure_type = p_disclosure_type,
    legal_basis_summary = p_legal_basis_summary,
    scope_summary = p_scope_summary,
    recipient_organization = p_recipient_organization,
    recipient_contact_ref = p_recipient_contact_ref,
    member_notice_decision = p_member_notice_decision,
    delayed_notice_basis = p_delayed_notice_basis,
    updated_by = p_actor_id
  where id = p_disclosure_id
    and request_id = p_request_id
    and status = 'draft'
  returning * into disclosure_row;

  if disclosure_row.id is null then
    raise exception 'Disclosure draft update was blocked.' using errcode = '42501';
  end if;

  return disclosure_row;
end;
$$;

create or replace function public.legal_add_disclosure_manifest_item(
  p_request_id uuid,
  p_disclosure_id uuid,
  p_resource_key text,
  p_source_system text,
  p_record_ref text,
  p_field_names text[],
  p_minimum_necessary_justification text,
  p_actor_id uuid
)
returns public.legal_disclosure_items
language plpgsql
security definer
set search_path = public
as $$
declare
  disclosure_row public.legal_disclosures;
  item_row public.legal_disclosure_items;
  normalized_fields text[];
begin
  select *
  into disclosure_row
  from public.legal_disclosures disclosure
  where disclosure.id = p_disclosure_id
    and disclosure.request_id = p_request_id
  for update;

  if not found then
    raise exception 'Disclosure draft not found.' using errcode = '22023';
  end if;

  if disclosure_row.status <> 'draft' then
    raise exception 'Manifest items may only be prepared for a draft disclosure.' using errcode = '42501';
  end if;

  if p_field_names is null or cardinality(p_field_names) < 1 or cardinality(p_field_names) > 50 then
    raise exception 'Manifest preparation requires between 1 and 50 explicit field names.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_field_names) field_name
    where btrim(field_name) = ''
      or char_length(btrim(field_name)) > 200
      or lower(btrim(field_name)) in ('*', 'all', 'all_fields', 'all fields')
  ) then
    raise exception 'Manifest field names must be explicit and bounded.' using errcode = '22023';
  end if;

  select array_agg(distinct btrim(field_name) order by btrim(field_name))
  into normalized_fields
  from unnest(p_field_names) field_name;

  insert into public.legal_disclosure_items (
    disclosure_id,
    resource_key,
    source_system,
    record_ref,
    field_names,
    object_count,
    file_name,
    sha256,
    minimum_necessary_justification,
    metadata,
    created_by
  ) values (
    p_disclosure_id,
    p_resource_key,
    p_source_system,
    p_record_ref,
    normalized_fields,
    0,
    null,
    null,
    p_minimum_necessary_justification,
    '{}'::jsonb,
    p_actor_id
  )
  returning * into item_row;

  -- This event is in the same database transaction as the append-only manifest item.
  -- It records metadata only, never responsive source content.
  insert into public.legal_request_events (
    request_id,
    disclosure_id,
    event_type,
    action,
    purpose,
    details,
    actor_id
  ) values (
    p_request_id,
    p_disclosure_id,
    'disclosure_updated',
    'legal_disclosure_manifest_item_added',
    'Record least-data disclosure manifest preparation.',
    jsonb_strip_nulls(jsonb_build_object(
      'item_id', item_row.id,
      'resource_key', item_row.resource_key,
      'source_system', item_row.source_system,
      'record_ref', item_row.record_ref,
      'field_count', cardinality(item_row.field_names)
    )),
    p_actor_id
  );

  return item_row;
end;
$$;

revoke all on function public.legal_create_disclosure_draft(uuid, text, text, text, text, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.legal_update_disclosure_draft(uuid, uuid, text, text, text, text, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.legal_add_disclosure_manifest_item(uuid, uuid, text, text, text, text[], text, uuid)
  from public, anon, authenticated;

grant execute on function public.legal_create_disclosure_draft(uuid, text, text, text, text, text, text, text, uuid)
  to service_role;
grant execute on function public.legal_update_disclosure_draft(uuid, uuid, text, text, text, text, text, text, text, uuid)
  to service_role;
grant execute on function public.legal_add_disclosure_manifest_item(uuid, uuid, text, text, text, text[], text, uuid)
  to service_role;

comment on function public.legal_create_disclosure_draft(uuid, text, text, text, text, text, text, text, uuid) is
'Issue #674 preparation-only RPC. Creates draft disclosure control metadata; does not generate or disclose data.';
comment on function public.legal_update_disclosure_draft(uuid, uuid, text, text, text, text, text, text, text, uuid) is
'Issue #674 preparation-only RPC. Updates draft metadata without changing approval, export, or transmission state.';
comment on function public.legal_add_disclosure_manifest_item(uuid, uuid, text, text, text, text[], text, uuid) is
'Issue #674 least-data manifest RPC. Records intended source/field metadata only; file payloads, hashes, object exports, and transmission are excluded.';

commit;
