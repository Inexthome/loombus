-- Verification for 20260804012000_gate_floor_track_record_viewing_by_eligibility.sql.
--
-- Proves a minor cannot read floor_calls or floor_member_credibility (the
-- Floor's track-record/scoreboard surface) while an eligible adult member
-- still can. Runs inside a transaction and rolls back at the end. Every
-- returned row must have status = PASS.

begin;

do $$
declare
  minor_id uuid := gen_random_uuid();
  adult_id uuid := gen_random_uuid();
  author_id uuid := gen_random_uuid();
  thesis_id uuid;
  minor_sees_calls boolean;
  adult_sees_calls boolean;
  minor_sees_credibility boolean;
  adult_sees_credibility boolean;
begin
  insert into auth.users (id) values (minor_id), (adult_id), (author_id);
  insert into public.profiles (id, username) values
    (minor_id, 'audit-minor-viewer'),
    (adult_id, 'audit-adult-viewer'),
    (author_id, 'audit-call-author');
  insert into public.profile_sensitive (id, age_band) values
    (minor_id, 'minor'), (adult_id, 'adult'), (author_id, 'adult');

  insert into public.floor_theses (author_id, ticker, stance, conviction, horizon, exit_plan, thesis)
  values (author_id, 'XYZ', 'long', 3, 'months', 'Exit at target.', 'A thesis with a resolved call.')
  returning id into thesis_id;

  insert into public.floor_calls
    (thesis_id, author_id, ticker, prediction, comparator, target_value, resolves_by, status, outcome, resolved_value, resolved_at, resolved_by)
  values
    (thesis_id, author_id, 'XYZ', 'XYZ above 50', 'gte', 50, now() - interval '1 day', 'resolved', 'correct', 55, now(), author_id);

  create temporary table floor_eligibility_checks (
    check_name text,
    observed boolean,
    expected boolean
  ) on commit drop;

  perform set_config('request.jwt.claim.sub', minor_id::text, true);
  set local role authenticated;
  minor_sees_calls := exists (select 1 from public.floor_calls limit 1);
  minor_sees_credibility := exists (select 1 from public.floor_member_credibility limit 1);
  reset role;

  perform set_config('request.jwt.claim.sub', adult_id::text, true);
  set local role authenticated;
  adult_sees_calls := exists (select 1 from public.floor_calls limit 1);
  adult_sees_credibility := exists (select 1 from public.floor_member_credibility limit 1);
  reset role;

  perform set_config('request.jwt.claim.sub', '', true);

  insert into floor_eligibility_checks values
    ('minor_cannot_see_floor_calls', minor_sees_calls, false),
    ('minor_cannot_see_credibility', minor_sees_credibility, false),
    ('adult_can_see_floor_calls', adult_sees_calls, true),
    ('adult_can_see_credibility', adult_sees_credibility, true);
end;
$$;

select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from floor_eligibility_checks
order by check_name;

rollback;
