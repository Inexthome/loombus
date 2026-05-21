-- Loombus Labs / Priority Feature Access setup
-- Purpose:
-- - Make Priority Feature Access a real Premium Plus/Admin feature.
-- - Allow Premium Plus/Admin users to submit feature requests.
-- - Allow users to read their own requests.
-- - Allow Admin users to review, status, and annotate feature requests.

create table if not exists public.labs_feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  status text not null default 'submitted',
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint labs_feature_requests_title_length
    check (char_length(trim(title)) between 3 and 120),
  constraint labs_feature_requests_description_length
    check (char_length(trim(description)) between 10 and 2000),
  constraint labs_feature_requests_admin_note_length
    check (admin_note is null or char_length(admin_note) <= 2000),
  constraint labs_feature_requests_status_check
    check (status in ('submitted', 'reviewing', 'planned', 'shipped', 'declined'))
);

create index if not exists labs_feature_requests_user_created_idx
  on public.labs_feature_requests (user_id, created_at desc);

create index if not exists labs_feature_requests_status_created_idx
  on public.labs_feature_requests (status, created_at desc);

create index if not exists labs_feature_requests_reviewed_by_idx
  on public.labs_feature_requests (reviewed_by);

create or replace function public.user_has_loombus_labs_access(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = target_user_id
      and profile.is_admin = true
  )
  or exists (
    select 1
    from public.user_ai_entitlements entitlement
    where entitlement.user_id = target_user_id
      and (
        entitlement.tier = 'admin'
        or (
          entitlement.ai_assisted_enabled = true
          and entitlement.tier = 'premium'
          and entitlement.monthly_summary_limit > 50
        )
      )
  );
$$;

create or replace function public.user_is_loombus_admin(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = target_user_id
      and profile.is_admin = true
  );
$$;

create or replace function public.set_labs_feature_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  if new.status is distinct from old.status or new.admin_note is distinct from old.admin_note then
    new.reviewed_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists set_labs_feature_requests_updated_at
  on public.labs_feature_requests;

create trigger set_labs_feature_requests_updated_at
before update on public.labs_feature_requests
for each row
execute function public.set_labs_feature_requests_updated_at();

alter table public.labs_feature_requests enable row level security;

drop policy if exists "Users can read their own Labs requests"
  on public.labs_feature_requests;

create policy "Users can read their own Labs requests"
on public.labs_feature_requests
for select
using (
  auth.uid() = user_id
  or public.user_is_loombus_admin(auth.uid())
);

drop policy if exists "Premium Plus users can create Labs requests"
  on public.labs_feature_requests;

create policy "Premium Plus users can create Labs requests"
on public.labs_feature_requests
for insert
with check (
  auth.uid() = user_id
  and public.user_has_loombus_labs_access(user_id)
);

drop policy if exists "Admins can update Labs requests"
  on public.labs_feature_requests;

create policy "Admins can update Labs requests"
on public.labs_feature_requests
for update
using (public.user_is_loombus_admin(auth.uid()))
with check (public.user_is_loombus_admin(auth.uid()));

drop policy if exists "Admins can delete Labs requests"
  on public.labs_feature_requests;

create policy "Admins can delete Labs requests"
on public.labs_feature_requests
for delete
using (public.user_is_loombus_admin(auth.uid()));

comment on table public.labs_feature_requests is
'Premium Plus/Admin Loombus Labs feature requests and admin review workflow.';

comment on column public.labs_feature_requests.status is
'Labs request status: submitted, reviewing, planned, shipped, or declined.';
