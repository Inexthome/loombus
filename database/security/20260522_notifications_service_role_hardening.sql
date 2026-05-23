-- Loombus Notifications Service-Role Hardening
-- Apply only after notification creation uses server/service-role helpers.

alter table public.notifications enable row level security;

-- Preserve owner read/update/delete behavior.
drop policy if exists "Users can read their own notifications"
on public.notifications;

create policy "Users can read their own notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can update their own notifications"
on public.notifications;

create policy "Users can update their own notifications"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notifications"
on public.notifications;

create policy "Users can delete their own notifications"
on public.notifications
for delete
to authenticated
using (auth.uid() = user_id);

-- Remove any direct normal-client notification creation policy.
drop policy if exists "Users can create notifications"
on public.notifications;

drop policy if exists "Authenticated users can create notifications"
on public.notifications;

drop policy if exists "Users can insert notifications"
on public.notifications;

drop policy if exists "Authenticated users can insert notifications"
on public.notifications;

drop policy if exists "Users can create their own notifications"
on public.notifications;

drop policy if exists "Users can insert their own notifications"
on public.notifications;

revoke all on table public.notifications from anon;
revoke insert on table public.notifications from authenticated;
grant select, update, delete on table public.notifications to authenticated;

-- Verification: policies.
select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'notifications'
order by policyname;

-- Verification: anon should have no notification privileges; authenticated should not have INSERT.
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'notifications'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
