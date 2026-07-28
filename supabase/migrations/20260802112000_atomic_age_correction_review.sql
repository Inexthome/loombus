-- Issue #679 remediation: make protected age-correction review atomic and
-- independent of legacy JWT claim settings used by direct table updates.

begin;

create or replace function public.enforce_profile_sensitive_age_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_band text;
  authorized_correction_user_id text;
begin
  derived_band := public.compute_loombus_age_band(new.date_of_birth);

  if derived_band is null then
    raise exception 'Invalid date of birth.' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE'
     and old.date_of_birth is not null
     and new.date_of_birth is distinct from old.date_of_birth then
    authorized_correction_user_id := current_setting(
      'loombus.age_correction_user_id',
      true
    );

    if coalesce(authorized_correction_user_id, '') <> new.id::text then
      raise exception 'Date of birth changes require the protected correction workflow.'
        using errcode = '42501';
    end if;
  end if;

  new.age_band := derived_band;
  new.teen_safety_mode := derived_band in ('under_13', 'teen');
  new.guardian_required := derived_band = 'under_13';

  return new;
end;
$$;

create or replace function public.review_age_correction_request(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_action text,
  p_resolution_note text default null
)
returns table(
  review_status text,
  member_id uuid,
  requested_age_band text
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  correction public.age_correction_requests%rowtype;
  normalized_note text := nullif(btrim(coalesce(p_resolution_note, '')), '');
  next_status text;
begin
  if p_request_id is null or p_reviewer_id is null then
    raise exception 'Invalid age-correction review payload.' using errcode = '22023';
  end if;

  if coalesce(p_action, '') not in ('review', 'approve', 'deny') then
    raise exception 'Unsupported correction action.' using errcode = '22023';
  end if;

  if normalized_note is not null and char_length(normalized_note) > 2000 then
    raise exception 'Resolution note exceeds 2,000 characters.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_reviewer_id
      and coalesce(p.is_admin, false) = true
  ) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  select acr.*
  into correction
  from public.age_correction_requests acr
  where acr.id = p_request_id
  for update;

  if not found then
    raise exception 'Correction request not found.' using errcode = 'P0002';
  end if;

  if p_action = 'review' then
    if correction.status <> 'submitted' then
      raise exception 'Only submitted correction requests can enter review.'
        using errcode = '55000';
    end if;

    next_status := 'reviewing';

    update public.age_correction_requests
    set
      status = next_status,
      reviewed_by = p_reviewer_id,
      reviewed_at = now(),
      resolution_note = normalized_note
    where id = correction.id;
  else
    if correction.status not in ('submitted', 'reviewing') then
      raise exception 'This correction request is already resolved.'
        using errcode = '55000';
    end if;

    next_status := case when p_action = 'approve' then 'approved' else 'denied' end;

    if p_action = 'approve' then
      perform set_config(
        'loombus.age_correction_user_id',
        correction.user_id::text,
        true
      );

      update public.profile_sensitive
      set date_of_birth = correction.requested_date_of_birth
      where id = correction.user_id;

      if not found then
        raise exception 'Member age record not found.' using errcode = 'P0002';
      end if;

      perform set_config('loombus.age_correction_user_id', '', true);
    end if;

    update public.age_correction_requests
    set
      status = next_status,
      reviewed_by = p_reviewer_id,
      reviewed_at = now(),
      resolution_note = normalized_note
    where id = correction.id;
  end if;

  return query
  select next_status, correction.user_id, correction.requested_age_band;
exception
  when others then
    perform set_config('loombus.age_correction_user_id', '', true);
    raise;
end;
$$;

revoke all on function public.review_age_correction_request(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_age_correction_request(uuid, uuid, text, text)
  to service_role;

revoke all on function public.enforce_profile_sensitive_age_state()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
