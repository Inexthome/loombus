-- Verification for 20260804012000_gate_floor_track_record_viewing_by_eligibility.sql.
--
-- Proves a minor cannot read floor_calls or floor_member_credibility (the
-- Floor's track-record/scoreboard surface) while an eligible adult member
-- still can. Runs inside a transaction and rolls back at the end. Look at
-- the Messages/Notices output (not the results grid -- some SQL editors,
-- including Supabase Studio, only render the LAST statement's result set,
-- and this script ends on ROLLBACK). Every line should end PASS.

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

  raise notice '% | minor_cannot_see_floor_calls (observed=%, expected=false)',
    case when minor_sees_calls = false then 'PASS' else 'FAIL' end, minor_sees_calls;
  raise notice '% | minor_cannot_see_credibility (observed=%, expected=false)',
    case when minor_sees_credibility = false then 'PASS' else 'FAIL' end, minor_sees_credibility;
  raise notice '% | adult_can_see_floor_calls (observed=%, expected=true)',
    case when adult_sees_calls = true then 'PASS' else 'FAIL' end, adult_sees_calls;
  raise notice '% | adult_can_see_credibility (observed=%, expected=true)',
    case when adult_sees_credibility = true then 'PASS' else 'FAIL' end, adult_sees_credibility;
end;
$$;

rollback;
