-- Refresh deployment checks for PR #462.
alter table public.rooms
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists template_key text,
  add column if not exists subscription_plan text,
  add column if not exists subscription_status text,
  add column if not exists member_limit integer,
  add column if not exists invite_only boolean not null default true;
