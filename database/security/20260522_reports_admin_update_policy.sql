-- Loombus Reports Admin Update Policy
-- Date: 2026-05-22
--
-- Purpose:
-- Allow admins to update report review metadata while keeping normal users
-- limited to report creation only.

drop policy if exists "Admins can update reports"
on public.reports;

create policy "Admins can update reports"
on public.reports
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

-- Verification
select
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename = 'reports'
order by policyname;
