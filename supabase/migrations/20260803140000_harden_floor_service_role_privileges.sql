-- The Floor: close a real privilege gap on service_role.
--
-- Root cause: every prior Floor migration wrote grants like
-- `grant select, insert, update on table X to service_role` and assumed that
-- meant "and nothing else" -- but GRANT is additive, it does not revoke
-- privileges a role already has from elsewhere. Supabase gives service_role
-- broad default privileges on the public schema at the platform level, and
-- no prior migration ever issued `revoke all ... from service_role` to clear
-- that baseline first. Confirmed empirically in production: a scoped DELETE
-- against floor_calls via the service-role client succeeded, despite no
-- migration ever granting delete -- the exact opposite of the "not even
-- service_role can delete a resolved call" guarantee stated in the schema
-- PR and repeated since.
--
-- This migration revokes ALL service_role privileges on every Floor table
-- first, then re-grants exactly what the actual code paths use (verified by
-- grepping every `createFloorServiceSupabase()` call site), so the enforced
-- state finally matches what was always claimed. Two tables end up tighter
-- than originally documented, both confirmed unused by any current code:
--
--   * floor_theses: service_role only ever SELECTs it (the admin review
--     queue's embedded join from floor_calls). No code path inserts or
--     updates a thesis via service_role -- that always goes through the
--     bearer-scoped client as the thesis owner.
--   * floor_calls: service_role only ever SELECTs it (the resolver finding
--     due calls). The one thing that stamps an outcome onto floor_calls,
--     approve_floor_call_resolution_proposal(), is `security definer` --
--     it runs with the function owner's privileges, not the caller's, so
--     it never needed service_role to hold its own update grant here.
--
-- weekly_digests keeps full service_role CRUD, exactly as originally
-- intended -- reasserted explicitly rather than left to an inherited
-- default, so its state is no longer just "probably fine."

begin;

revoke all on table public.floor_theses from service_role;
grant select on table public.floor_theses to service_role;

revoke all on table public.floor_thesis_analyses from service_role;
grant select, insert on table public.floor_thesis_analyses to service_role;

revoke all on table public.floor_calls from service_role;
grant select on table public.floor_calls to service_role;

revoke all on table public.floor_call_resolution_proposals from service_role;
grant select, insert, update on table public.floor_call_resolution_proposals to service_role;

revoke all on table public.weekly_digests from service_role;
grant select, insert, update, delete on table public.weekly_digests to service_role;

notify pgrst, 'reload schema';

commit;
