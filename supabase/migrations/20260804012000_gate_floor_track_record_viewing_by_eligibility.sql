-- 20260803110000's schema comment already claims "Minors are excluded from
-- posting and from the credibility/track-record surface via
-- floor_member_is_eligible()" -- true for posting (every INSERT policy
-- checks it), never true for viewing: floor_calls SELECT was `using (true)`
-- and floor_member_credibility carried no eligibility filter at all. Any
-- authenticated member, including a minor, could read the full scoreboard
-- and every member's call history. This closes that gap the way the
-- comment already said it worked.

begin;

drop policy if exists "Floor calls are publicly visible for the scoreboard" on public.floor_calls;
create policy "Floor calls are visible to eligible members"
on public.floor_calls for select to authenticated
using (public.floor_member_is_eligible());

create or replace view public.floor_member_credibility
with (security_invoker = true) as
select
  p.id as member_id,
  p.username,
  p.full_name,
  count(c.id) filter (where c.status = 'pending') as pending_calls,
  count(c.id) filter (where c.status = 'resolved') as resolved_calls,
  count(c.id) filter (where c.outcome = 'correct') as correct_calls,
  count(c.id) filter (where c.outcome = 'incorrect') as incorrect_calls,
  count(c.id) filter (where c.outcome = 'partial') as partial_calls,
  case
    when count(c.id) filter (where c.status = 'resolved' and c.outcome in ('correct', 'incorrect')) > 0
      then round(
        100.0 * count(c.id) filter (where c.outcome = 'correct')
          / count(c.id) filter (where c.status = 'resolved' and c.outcome in ('correct', 'incorrect')),
        1
      )
    else null
  end as accuracy_pct,
  max(c.resolved_at) as last_resolved_at
from public.profiles p
join public.floor_calls c on c.author_id = p.id
where public.floor_member_is_eligible()
group by p.id, p.username, p.full_name;

revoke all on public.floor_member_credibility from anon;
grant select on public.floor_member_credibility to authenticated;

comment on view public.floor_member_credibility is
  'Member track record derived live from resolved floor_calls. Never stored -- always computed. Only visible to eligible (adult, non-suspended) viewers.';

commit;
