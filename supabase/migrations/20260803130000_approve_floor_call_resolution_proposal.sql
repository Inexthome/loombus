-- The Floor: atomic approval of a call resolution proposal.
--
-- Approving a proposal has to do two things together or not at all: stamp
-- the real outcome onto floor_calls (the public, permanent scoreboard entry)
-- and mark the proposal reviewed. Two separate client-side UPDATE calls could
-- succeed and fail independently -- e.g. floor_calls gets stamped but the
-- proposal never shows as reviewed, or vice versa. This function does both
-- inside one transaction so a partial failure can't happen.
--
-- Everything floor_calls already enforces still applies: this function does
-- not bypass enforce_floor_call_resolution_integrity (20260803110000) --
-- it just performs a normal UPDATE that trigger validates like any other.
-- Only service_role may call this function; there is no path for a member,
-- or even an authenticated admin's own session, to invoke it directly.

begin;

create or replace function public.approve_floor_call_resolution_proposal(
  p_proposal_id uuid,
  p_admin_id uuid,
  p_final_outcome text,
  p_review_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call_id uuid;
  v_resolved_value numeric(18, 6);
  v_proposal_status text;
begin
  if p_final_outcome not in ('correct', 'incorrect', 'partial') then
    raise exception 'Invalid outcome.' using errcode = '22023';
  end if;

  select call_id, proposed_resolved_value, status
    into v_call_id, v_resolved_value, v_proposal_status
  from public.floor_call_resolution_proposals
  where id = p_proposal_id
  for update;

  if v_call_id is null then
    raise exception 'Proposal not found.' using errcode = 'P0002';
  end if;

  if v_proposal_status <> 'pending' then
    raise exception 'Proposal has already been reviewed.' using errcode = '42501';
  end if;

  update public.floor_calls
  set status = 'resolved',
      outcome = p_final_outcome,
      outcome_note = p_review_note,
      resolved_value = v_resolved_value,
      resolved_by = p_admin_id
  where id = v_call_id;

  update public.floor_call_resolution_proposals
  set status = 'approved',
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      review_note = p_review_note
  where id = p_proposal_id;
end;
$$;

revoke all on function public.approve_floor_call_resolution_proposal(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.approve_floor_call_resolution_proposal(uuid, uuid, text, text)
  to service_role;

comment on function public.approve_floor_call_resolution_proposal is
  'Atomically stamps floor_calls with the reviewed outcome and marks the proposal approved. service_role only.';

notify pgrst, 'reload schema';

commit;
