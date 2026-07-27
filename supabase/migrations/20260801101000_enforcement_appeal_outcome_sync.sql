-- Keep the canonical decision state aligned with an appeal outcome even when
-- restoration is partial, blocked, or requires a manual product adapter.

begin;

create or replace function public.sync_enforcement_appeal_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  decision_status text;
begin
  if new.outcome is null then
    return new;
  end if;

  decision_status := case new.outcome
    when 'APL.OUTCOME_UPHELD' then 'upheld'
    when 'APL.OUTCOME_MODIFIED' then 'modified'
    when 'APL.OUTCOME_REVERSED' then 'reversed'
    when 'APL.OUTCOME_REMANDED' then 'remanded'
    else 'unable_to_review'
  end;

  update public.enforcement_decisions
  set status = decision_status,
      reviewer_user_id = new.assigned_reviewer_id,
      resolved_at = case
        when new.outcome = 'APL.OUTCOME_REMANDED' then null
        else coalesce(new.decided_at, now())
      end
  where id = new.decision_id;

  return new;
end;
$$;

drop trigger if exists sync_enforcement_appeal_outcome_trigger
  on public.enforcement_appeals;
create trigger sync_enforcement_appeal_outcome_trigger
after insert or update of outcome, assigned_reviewer_id, decided_at
on public.enforcement_appeals
for each row execute function public.sync_enforcement_appeal_outcome();

revoke all on function public.sync_enforcement_appeal_outcome()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
