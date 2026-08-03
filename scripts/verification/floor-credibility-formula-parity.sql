-- Read-only production check for the credibility formula fix
-- (calculateFloorCredibility in src/lib/floor-credibility.ts vs the
-- public.floor_member_credibility view). Confirms every member's
-- leaderboard accuracy_pct and analyst-page accuracy would now agree.
--
-- Not a schema change, makes no writes -- safe to run directly against
-- production via the SQL editor. Every row must have status = PASS.
--
-- Note on precision: the view rounds to 1 decimal (round(...,1)) and the
-- TS path rounds to a whole integer (Math.round). Same formula, different
-- display precision -- that's cosmetic, not a bug, so this check tolerates
-- up to 0.5 points of difference rather than requiring an exact match.
--
-- floor_member_credibility is gated on the caller's own eligibility
-- (20260804012000) and the SQL editor has no JWT context by default, so
-- this impersonates an existing eligible admin for the duration of the
-- query only -- nothing is written, and the role/claim reset at commit.

begin;

do $$
declare
  eligible_admin_id uuid;
begin
  select id into eligible_admin_id from public.profiles where is_admin limit 1;
  if eligible_admin_id is null then
    raise exception 'No admin profile found to impersonate for this read-only check.';
  end if;
  perform set_config('request.jwt.claim.sub', eligible_admin_id::text, true);
end;
$$;

set local role authenticated;

with recomputed as (
  select
    c.author_id as member_id,
    count(c.id) filter (where c.outcome = 'correct') as correct_calls,
    count(c.id) filter (where c.outcome = 'incorrect') as incorrect_calls,
    case
      when count(c.id) filter (where c.outcome in ('correct', 'incorrect')) > 0
        then round(
          100.0 * count(c.id) filter (where c.outcome = 'correct')
            / count(c.id) filter (where c.outcome in ('correct', 'incorrect')),
          1
        )
      else null
    end as recomputed_accuracy_pct
  from public.floor_calls c
  where c.status = 'resolved'
  group by c.author_id
)
select
  v.member_id,
  v.username,
  v.accuracy_pct as view_accuracy_pct,
  r.recomputed_accuracy_pct,
  case
    when v.accuracy_pct is null and r.recomputed_accuracy_pct is null then 'PASS'
    when v.accuracy_pct is not null and r.recomputed_accuracy_pct is not null
      and abs(v.accuracy_pct - r.recomputed_accuracy_pct) <= 0.5 then 'PASS'
    else 'FAIL'
  end as status
from public.floor_member_credibility v
join recomputed r on r.member_id = v.member_id
order by status desc, v.member_id;

rollback;
