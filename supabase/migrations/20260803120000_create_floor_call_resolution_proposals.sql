-- The Floor: resolution proposals for floor_calls.
--
-- floor_calls is intentionally locked so that only a service-role resolver
-- can stamp an outcome, and only once (enforce_floor_call_resolution_integrity
-- in 20260803110000_create_the_floor_schema.sql). This migration adds a
-- staging table the resolver writes candidate outcomes into -- it does NOT
-- let the resolver touch floor_calls directly. A human admin reviews each
-- proposal and only their approval (a future PR's admin route, running as
-- service_role) actually stamps floor_calls. Getting a resolution wrong is
-- worse than not resolving it yet, so nothing here is auto-applied.
--
-- Proposals are never publicly visible -- only admins can read this table.
-- The public scoreboard is still driven entirely by floor_calls itself.

begin;

create table if not exists public.floor_call_resolution_proposals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.floor_calls(id) on delete cascade,
  status text not null default 'pending',
  proposed_outcome text not null,
  proposed_resolved_value numeric(18, 6) not null,
  data_source text not null default 'twelve_data',
  resolved_on date not null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floor_call_resolution_proposals_status_check check (
    status in ('pending', 'approved', 'rejected')
  ),
  constraint floor_call_resolution_proposals_outcome_check check (
    proposed_outcome in ('correct', 'incorrect')
  ),
  constraint floor_call_resolution_proposals_review_shape_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or
    (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

create index if not exists floor_call_resolution_proposals_call_idx
  on public.floor_call_resolution_proposals (call_id);
create index if not exists floor_call_resolution_proposals_status_created_idx
  on public.floor_call_resolution_proposals (status, created_at desc);

-- At most one pending proposal per call, so repeated resolver runs before a
-- review happens don't pile up duplicate proposals for the same call.
create unique index if not exists floor_call_resolution_proposals_one_pending_idx
  on public.floor_call_resolution_proposals (call_id)
  where status = 'pending';

drop trigger if exists touch_floor_call_resolution_proposals_updated_at
  on public.floor_call_resolution_proposals;
create trigger touch_floor_call_resolution_proposals_updated_at
before update on public.floor_call_resolution_proposals
for each row execute function public.touch_floor_updated_at();

alter table public.floor_call_resolution_proposals enable row level security;

drop policy if exists "Floor call resolution proposals are visible to admins only"
  on public.floor_call_resolution_proposals;
create policy "Floor call resolution proposals are visible to admins only"
on public.floor_call_resolution_proposals for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin
  )
);

revoke all on table public.floor_call_resolution_proposals from anon;

revoke insert, update, delete on table public.floor_call_resolution_proposals from authenticated;
grant select on table public.floor_call_resolution_proposals to authenticated;

grant select, insert, update on table public.floor_call_resolution_proposals to service_role;

comment on table public.floor_call_resolution_proposals is
  'Candidate outcomes for floor_calls, written by the service-role resolver and reviewed by an admin before floor_calls is ever stamped. Not part of the public scoreboard.';

notify pgrst, 'reload schema';

commit;
