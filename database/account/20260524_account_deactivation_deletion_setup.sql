-- Loombus account deactivation and deletion-request foundation
--
-- Purpose:
-- Add self-service account exit states without hard-deleting auth.users yet.
-- This preserves moderation, audit, safety, and billing integrity while giving
-- members a clear path to deactivate or request deletion.
--
-- New account statuses:
-- - deactivated: user chose to disable account access/actions
-- - deletion_requested: user requested account deletion review/processing
--
-- Hard auth-user deletion is intentionally deferred until cascade behavior,
-- billing cancellation, audit retention, and content anonymization rules are
-- fully reviewed.

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
  check (
    account_status in (
      'active',
      'warned',
      'suspended',
      'banned',
      'deactivated',
      'deletion_requested'
    )
  );

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  constraint account_deletion_requests_status_check
    check (status in ('requested', 'reviewing', 'completed', 'cancelled')),
  constraint account_deletion_requests_reason_length
    check (reason is null or char_length(trim(reason)) <= 2000),
  constraint account_deletion_requests_admin_note_length
    check (admin_note is null or char_length(trim(admin_note)) <= 2000)
);

create index if not exists account_deletion_requests_user_id_idx
on public.account_deletion_requests(user_id);

create index if not exists account_deletion_requests_status_requested_idx
on public.account_deletion_requests(status, requested_at desc);

create unique index if not exists account_deletion_requests_open_user_idx
on public.account_deletion_requests(user_id)
where status in ('requested', 'reviewing');

alter table public.account_deletion_requests enable row level security;

drop policy if exists "Users can read own account deletion requests"
on public.account_deletion_requests;

create policy "Users can read own account deletion requests"
on public.account_deletion_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can create own account deletion requests"
on public.account_deletion_requests;

create policy "Users can create own account deletion requests"
on public.account_deletion_requests
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Admins can read account deletion requests"
on public.account_deletion_requests;

create policy "Admins can read account deletion requests"
on public.account_deletion_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_admin = true
  )
);

drop policy if exists "Admins can update account deletion requests"
on public.account_deletion_requests;

create policy "Admins can update account deletion requests"
on public.account_deletion_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_admin = true
  )
);

comment on table public.account_deletion_requests is
'Tracks self-service account deletion requests without hard-deleting auth users immediately.';

comment on column public.account_deletion_requests.status is
'Deletion request workflow status: requested, reviewing, completed, or cancelled.';
