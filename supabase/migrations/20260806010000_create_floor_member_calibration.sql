-- floor_member_calibration: per-member, per-conviction-bucket resolved-call
-- counts, backing the calibration panel ("when you said 4/5 conviction,
-- you were right 61% of the time"). Computed live from floor_calls joined
-- to floor_theses (conviction lives on the thesis, not the call) --
-- never stored, same philosophy as floor_member_credibility.
--
-- Universe matches floor_member_credibility's accuracy definition exactly
-- (status='resolved' and outcome in ('correct','incorrect'); status='void'
-- and outcome='partial' both excluded from numerator and denominator) --
-- the two must never diverge on what counts as a "hit".
--
-- Privacy reuses floor_member_leaderboard_visibility() (20260805020000),
-- the same security-definer path the leaderboard opt-out uses -- a naive
-- join to floor_member_preferences would only ever resolve the CALLER's
-- own row under RLS, silently breaking the opt-out for every other
-- member. Unlike floor_member_credibility, a member always sees their own
-- buckets regardless of their own show_on_leaderboard setting (opting out
-- hides you from OTHERS, it does not hide your own track record from
-- yourself) -- the `t.author_id = auth.uid() or vis.is_public` clause
-- below is what encodes that.

begin;

create or replace view public.floor_member_calibration
with (security_invoker = true) as
select
  t.author_id as member_id,
  t.conviction,
  count(c.id) filter (where c.outcome = 'correct') as correct_calls,
  count(c.id) filter (where c.outcome = 'incorrect') as incorrect_calls,
  count(c.id) as resolved_binary_calls
from public.floor_calls c
join public.floor_theses t on t.id = c.thesis_id
cross join lateral public.floor_member_leaderboard_visibility(t.author_id) as vis
where c.status = 'resolved'
  and c.outcome in ('correct', 'incorrect')
  and public.floor_member_is_eligible()
  and (t.author_id = auth.uid() or vis.is_public)
group by t.author_id, t.conviction;

revoke all on public.floor_member_calibration from anon;
grant select on public.floor_member_calibration to authenticated;

comment on view public.floor_member_calibration is
  'Per-member, per-conviction-bucket resolved binary call counts, computed live from floor_calls joined to floor_theses. Never stored. Same universe as floor_member_credibility (partial and void excluded). A member always sees their own buckets; other members'' buckets respect floor_member_preferences.show_on_leaderboard via floor_member_leaderboard_visibility().';

notify pgrst, 'reload schema';

commit;
