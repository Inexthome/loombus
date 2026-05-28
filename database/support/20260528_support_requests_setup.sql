-- Loombus support request process
-- Adds structured support/contact intake separate from product notification email.
--
-- Supabase Data API policy:
-- Anonymous users may create support requests so logged-out users can contact support.
-- Authenticated users may create requests tied to their own account.
-- Admins may read/update support requests through RLS-backed admin tools.
-- No public read access is granted.

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  category text not null default 'general',
  subject text not null,
  message text not null,
  status text not null default 'new',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_requests_email_length
    check (char_length(trim(email)) between 3 and 320),
  constraint support_requests_subject_length
    check (char_length(trim(subject)) between 3 and 160),
  constraint support_requests_message_length
    check (char_length(trim(message)) between 10 and 4000),
  constraint support_requests_admin_note_length
    check (admin_note is null or char_length(admin_note) <= 2000),
  constraint support_requests_category_check
    check (
      category in (
        'general',
        'account',
        'billing',
        'safety',
        'accessibility',
        'bug',
        'feedback',
        'legal'
      )
    ),
  constraint support_requests_status_check
    check (status in ('new', 'reviewing', 'resolved', 'closed'))
);

create index if not exists support_requests_status_created_idx
on public.support_requests(status, created_at desc);

create index if not exists support_requests_user_created_idx
on public.support_requests(user_id, created_at desc);

create index if not exists support_requests_email_created_idx
on public.support_requests(email, created_at desc);

create or replace function public.set_support_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  if new.status is distinct from old.status
     or new.admin_note is distinct from old.admin_note then
    new.reviewed_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists set_support_requests_updated_at_trigger
on public.support_requests;

create trigger set_support_requests_updated_at_trigger
before update on public.support_requests
for each row
execute function public.set_support_requests_updated_at();

alter table public.support_requests enable row level security;

drop policy if exists "Anyone can create support requests"
on public.support_requests;

create policy "Anyone can create support requests"
on public.support_requests
for insert
to anon, authenticated
with check (
  user_id is null
  or user_id = auth.uid()
);

drop policy if exists "Users can read their own support requests"
on public.support_requests;

create policy "Users can read their own support requests"
on public.support_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can read support requests"
on public.support_requests;

create policy "Admins can read support requests"
on public.support_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

drop policy if exists "Admins can update support requests"
on public.support_requests;

create policy "Admins can update support requests"
on public.support_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

-- Explicit Supabase Data API grants/revokes.
revoke all on table public.support_requests from anon;
revoke all on table public.support_requests from authenticated;

grant insert on table public.support_requests to anon;
grant select, insert, update on table public.support_requests to authenticated;

comment on table public.support_requests is
'Structured support/contact requests submitted through Loombus contact workflows.';

comment on column public.support_requests.category is
'Support request category: general, account, billing, safety, accessibility, bug, feedback, or legal.';

comment on column public.support_requests.status is
'Admin review status: new, reviewing, resolved, or closed.';

-- Verification helper:
-- select exists (
--   select 1
--   from information_schema.tables
--   where table_schema = 'public'
--     and table_name = 'support_requests'
-- ) as table_exists,
-- (
--   select count(*)
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name = 'support_requests'
-- ) as column_count,
-- (
--   select count(*)
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name = 'support_requests'
--     and grantee = 'anon'
-- ) as anon_grant_count,
-- (
--   select count(*)
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name = 'support_requests'
--     and grantee = 'authenticated'
-- ) as authenticated_grant_count,
-- (
--   select count(*)
--   from pg_policies
--   where schemaname = 'public'
--     and tablename = 'support_requests'
-- ) as policy_count,
-- (
--   select count(*)
--   from pg_indexes
--   where schemaname = 'public'
--     and tablename = 'support_requests'
-- ) as expected_index_count;
