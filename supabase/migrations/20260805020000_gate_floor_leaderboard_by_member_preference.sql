-- Wire floor_member_preferences.show_on_leaderboard/leaderboard_display
-- into floor_member_credibility -- the RLS trap: the view is
-- security_invoker (deliberately, so the eligibility gate from
-- 20260804012000 keeps applying), and floor_member_preferences RLS only
-- lets a caller see their OWN row. A naive join from the view to
-- floor_member_preferences would make every OTHER member's
-- show_on_leaderboard read as null, silently breaking the opt-out for
-- everyone except the viewer's own row.
--
-- floor_member_leaderboard_visibility() is security definer specifically
-- to read across that boundary: it always resolves every member's own
-- preference regardless of caller, which is exactly what a
-- caller-independent "is this member opted out" check requires. It leaks
-- nothing sensitive -- show_on_leaderboard/leaderboard_display are the
-- two fields the leaderboard was always going to have to see anyway.

begin;

create or replace function public.floor_member_leaderboard_visibility(target_member_id uuid)
returns table(is_public boolean, leaderboard_display text)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(pref.show_on_leaderboard, true),
    coalesce(pref.leaderboard_display, 'username')
  from (select target_member_id as id) target
  left join public.floor_member_preferences pref on pref.user_id = target.id;
$$;

revoke all on function public.floor_member_leaderboard_visibility(uuid) from public;
grant execute on function public.floor_member_leaderboard_visibility(uuid) to authenticated;

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
  max(c.resolved_at) as last_resolved_at,
  vis.leaderboard_display
from public.profiles p
join public.floor_calls c on c.author_id = p.id
cross join lateral public.floor_member_leaderboard_visibility(p.id) as vis
where public.floor_member_is_eligible()
  and vis.is_public
group by p.id, p.username, p.full_name, vis.leaderboard_display;

revoke all on public.floor_member_credibility from anon;
grant select on public.floor_member_credibility to authenticated;

comment on view public.floor_member_credibility is
  'Member track record derived live from resolved floor_calls. Never stored -- always computed. Only visible to eligible (adult, non-suspended) viewers, and excludes members who opted out via floor_member_preferences.show_on_leaderboard.';

notify pgrst, 'reload schema';

commit;
