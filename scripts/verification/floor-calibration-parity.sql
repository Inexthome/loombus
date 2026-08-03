-- Verification for 20260806010000_create_floor_member_calibration.sql.
--
-- Proves public.floor_member_calibration's GROUP BY produces the correct
-- per-conviction-bucket counts for a known set of calls (the same fixture
-- used by scripts/verification/floor-calibration-parity.mts, so the two
-- checks together prove SQL-view / TS-function parity end to end): status
-- and outcome filtering, and that a member always sees their own buckets.
--
-- Safe to run directly against production: every row it seeds (fake
-- profile/theses/calls, clearly named audit-*) is explicitly deleted
-- again before the script's final SELECT runs. Every row in the results
-- must have status = PASS.

create temporary table if not exists floor_calibration_parity_results (
  check_name text,
  observed text,
  expected text,
  status text
);
truncate floor_calibration_parity_results;

do $$
declare
  author_id uuid := gen_random_uuid();
  thesis1 uuid;
  thesis2 uuid;
  thesis3 uuid;
  thesis4 uuid;
  thesis5 uuid;
  thesis_void uuid;
  thesis_partial uuid;
  bucket1_correct int;
  bucket1_incorrect int;
  bucket4_correct int;
  bucket4_incorrect int;
begin
  insert into auth.users (id) values (author_id);
  insert into public.profiles (id, username) values (author_id, 'audit-calibration-author');
  insert into public.profile_sensitive (id, date_of_birth) values (author_id, now() - interval '30 years');

  -- conviction 1: 2 correct, 1 incorrect
  insert into public.floor_theses (author_id, ticker, stance, conviction, horizon, exit_plan, thesis)
  values (author_id, 'AAA', 'long', 1, 'months', 'Exit at target.', 'Bucket 1 thesis.')
  returning id into thesis1;
  insert into public.floor_calls (thesis_id, author_id, ticker, prediction, comparator, target_value, resolves_by, status, outcome, resolved_value, resolved_at, resolved_by) values
    (thesis1, author_id, 'AAA', 'AAA above 10', 'gte', 10, now() - interval '1 day', 'resolved', 'correct', 15, now(), author_id),
    (thesis1, author_id, 'AAA', 'AAA above 10', 'gte', 10, now() - interval '1 day', 'resolved', 'correct', 15, now(), author_id),
    (thesis1, author_id, 'AAA', 'AAA above 10', 'gte', 10, now() - interval '1 day', 'resolved', 'incorrect', 5, now(), author_id);

  -- conviction 4: 2 correct, 3 incorrect (the deliberately-underperforming
  -- high-conviction bucket, matching the .mts fixture)
  insert into public.floor_theses (author_id, ticker, stance, conviction, horizon, exit_plan, thesis)
  values (author_id, 'BBB', 'long', 4, 'months', 'Exit at target.', 'Bucket 4 thesis.')
  returning id into thesis4;
  insert into public.floor_calls (thesis_id, author_id, ticker, prediction, comparator, target_value, resolves_by, status, outcome, resolved_value, resolved_at, resolved_by) values
    (thesis4, author_id, 'BBB', 'BBB above 10', 'gte', 10, now() - interval '1 day', 'resolved', 'correct', 15, now(), author_id),
    (thesis4, author_id, 'BBB', 'BBB above 10', 'gte', 10, now() - interval '1 day', 'resolved', 'correct', 15, now(), author_id),
    (thesis4, author_id, 'BBB', 'BBB above 10', 'gte', 10, now() - interval '1 day', 'resolved', 'incorrect', 5, now(), author_id),
    (thesis4, author_id, 'BBB', 'BBB above 10', 'gte', 10, now() - interval '1 day', 'resolved', 'incorrect', 5, now(), author_id),
    (thesis4, author_id, 'BBB', 'BBB above 10', 'gte', 10, now() - interval '1 day', 'resolved', 'incorrect', 5, now(), author_id);

  -- a void call and a partial call at conviction 1 -- must NOT be counted
  -- anywhere in the bucket-1 totals above.
  insert into public.floor_theses (author_id, ticker, stance, conviction, horizon, exit_plan, thesis)
  values (author_id, 'CCC', 'long', 1, 'months', 'Exit at target.', 'Void/partial thesis.')
  returning id into thesis_void;
  insert into public.floor_calls (thesis_id, author_id, ticker, prediction, comparator, target_value, resolves_by, status, outcome, resolved_value, resolved_at, resolved_by) values
    (thesis_void, author_id, 'CCC', 'CCC above 10', 'gte', 10, now() - interval '1 day', 'void', null, null, now(), author_id);
  insert into public.floor_calls (thesis_id, author_id, ticker, prediction, comparator, target_value, resolves_by, status, outcome, resolved_value, resolved_at, resolved_by) values
    (thesis_void, author_id, 'CCC', 'CCC above 10', 'gte', 10, now() - interval '1 day', 'resolved', 'partial', 10, now(), author_id);

  perform set_config('request.jwt.claim.sub', author_id::text, true);
  set local role authenticated;

  select correct_calls, incorrect_calls into bucket1_correct, bucket1_incorrect
  from public.floor_member_calibration where member_id = author_id and conviction = 1;

  select correct_calls, incorrect_calls into bucket4_correct, bucket4_incorrect
  from public.floor_member_calibration where member_id = author_id and conviction = 4;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  insert into floor_calibration_parity_results values
    ('bucket_1_correct_count', coalesce(bucket1_correct, -1)::text, '2', case when bucket1_correct = 2 then 'PASS' else 'FAIL' end),
    ('bucket_1_incorrect_count', coalesce(bucket1_incorrect, -1)::text, '1', case when bucket1_incorrect = 1 then 'PASS' else 'FAIL' end),
    ('bucket_4_correct_count', coalesce(bucket4_correct, -1)::text, '2', case when bucket4_correct = 2 then 'PASS' else 'FAIL' end),
    ('bucket_4_incorrect_count', coalesce(bucket4_incorrect, -1)::text, '3', case when bucket4_incorrect = 3 then 'PASS' else 'FAIL' end),
    ('void_and_partial_excluded_from_bucket_1', (bucket1_correct + bucket1_incorrect)::text, '3',
      case when (bucket1_correct + bucket1_incorrect) = 3 then 'PASS' else 'FAIL' end);

  -- Cleanup: remove everything this script seeded so nothing is left behind.
  delete from public.floor_calls where thesis_id in (thesis1, thesis4, thesis_void);
  delete from public.floor_theses where id in (thesis1, thesis4, thesis_void);
  delete from public.profile_sensitive where id = author_id;
  delete from public.profiles where id = author_id;
  delete from auth.users where id = author_id;
end;
$$;

select * from floor_calibration_parity_results order by check_name;
