-- Verification for 20260804010000_unify_floor_thesis_lifecycle_model.sql.
--
-- Proves withdraw/delete on a floor_theses row (via lifecycle_status, the
-- app's own vocabulary) actually leaves the live feed for other members
-- while a resolved call tied to it still counts toward the author's
-- floor_member_credibility -- calls are meant to be permanent accountability
-- records regardless of what later happens to the thesis that framed them.
--
-- Runs inside a transaction and rolls back at the end, so it is safe to run
-- against a live database, but is intended for a local `supabase db reset`
-- instance seeded with two throwaway profiles. Every returned row must have
-- status = PASS.

begin;

do $$
declare
  author_id uuid := gen_random_uuid();
  viewer_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  active_thesis_id uuid;
  withdrawn_thesis_id uuid;
  deleted_thesis_id uuid;
  call_id uuid;
  sees_active boolean;
  sees_withdrawn boolean;
  sees_deleted boolean;
  credibility_correct_calls int;
begin
  insert into auth.users (id) values (author_id), (viewer_id), (admin_id);
  insert into public.profiles (id, username, is_admin) values
    (author_id, 'audit-author', false),
    (viewer_id, 'audit-viewer', false),
    (admin_id, 'audit-admin', true);
  insert into public.profile_sensitive (id, age_band) values
    (author_id, 'adult'), (viewer_id, 'adult'), (admin_id, 'adult');

  insert into public.floor_theses
    (author_id, ticker, stance, conviction, horizon, exit_plan, thesis, lifecycle_status)
  values
    (author_id, 'ABC', 'long', 3, 'months', 'Exit at target.', 'Active thesis.', 'active')
  returning id into active_thesis_id;

  insert into public.floor_theses
    (author_id, ticker, stance, conviction, horizon, exit_plan, thesis, lifecycle_status, withdrawn_at)
  values
    (author_id, 'DEF', 'long', 3, 'months', 'Exit at target.', 'Withdrawn thesis.', 'withdrawn', now())
  returning id into withdrawn_thesis_id;

  insert into public.floor_theses
    (author_id, ticker, stance, conviction, horizon, exit_plan, thesis, lifecycle_status, deleted_at, deleted_by)
  values
    (author_id, 'GHI', 'long', 3, 'months', 'Exit at target.', 'Deleted thesis.', 'deleted', now(), author_id)
  returning id into deleted_thesis_id;

  insert into public.floor_calls
    (thesis_id, author_id, ticker, prediction, comparator, target_value, resolves_by, status, outcome, resolved_value, resolved_at, resolved_by)
  values
    (deleted_thesis_id, author_id, 'GHI', 'GHI above 100 by year end', 'gte', 100, now() - interval '1 day', 'resolved', 'correct', 105, now(), admin_id)
  returning id into call_id;

  create temporary table floor_lifecycle_checks (
    check_name text,
    observed boolean,
    expected boolean
  ) on commit drop;

  perform set_config('request.jwt.claim.sub', viewer_id::text, true);
  set local role authenticated;

  sees_active := exists (select 1 from public.floor_theses where id = active_thesis_id);
  sees_withdrawn := exists (select 1 from public.floor_theses where id = withdrawn_thesis_id);
  sees_deleted := exists (select 1 from public.floor_theses where id = deleted_thesis_id);

  reset role;

  -- floor_member_credibility is gated on the *caller's* eligibility (see
  -- 20260804012000) -- read it as the eligible admin viewer, not as the
  -- unauthenticated superuser session this script otherwise runs as.
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  set local role authenticated;
  credibility_correct_calls := (
    select correct_calls from public.floor_member_credibility where member_id = author_id
  );
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);

  insert into floor_lifecycle_checks values
    ('other_member_sees_active_thesis', sees_active, true),
    ('other_member_sees_withdrawn_thesis_in_feed', sees_withdrawn, true),
    ('other_member_cannot_see_deleted_thesis', sees_deleted, false);

  insert into floor_lifecycle_checks values (
    'resolved_call_on_deleted_thesis_still_counts_toward_credibility',
    credibility_correct_calls = 1,
    true
  );

  raise notice 'floor_lifecycle_checks populated';
end;
$$;

select
  check_name,
  observed,
  expected,
  case when observed = expected then 'PASS' else 'FAIL' end as status
from floor_lifecycle_checks
order by check_name;

rollback;
