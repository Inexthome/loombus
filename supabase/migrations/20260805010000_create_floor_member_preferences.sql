-- floor_member_preferences: one row per member, user-writable (unlike
-- floor_subscriptions, which is server-managed only). Backs the expanded
-- Floor settings page -- notification/alert toggles, display defaults for
-- the call composer and charts, and a leaderboard privacy opt-out.

begin;

create table if not exists public.floor_member_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  falsification_alerts_enabled boolean not null default true,
  alert_channel text not null default 'in_app',
  weave_digest text not null default 'weekly',
  earnings_reminders_enabled boolean not null default true,
  resolution_reminders_enabled boolean not null default true,
  calibration_nudge_enabled boolean not null default true,
  default_chart_timeframe text not null default '1d',
  default_call_horizon text,
  default_call_comparator text,
  show_on_leaderboard boolean not null default true,
  leaderboard_display text not null default 'username',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floor_member_preferences_alert_channel_check check (
    alert_channel in ('in_app', 'email', 'both')
  ),
  constraint floor_member_preferences_weave_digest_check check (
    weave_digest in ('weekly', 'off')
  ),
  constraint floor_member_preferences_chart_timeframe_check check (
    default_chart_timeframe in ('1d', '1w', '1m', 'ytd')
  ),
  constraint floor_member_preferences_call_horizon_check check (
    default_call_horizon is null
    or default_call_horizon in ('days', 'weeks', 'months', 'quarters', 'years')
  ),
  constraint floor_member_preferences_call_comparator_check check (
    default_call_comparator is null
    or default_call_comparator in ('gte', 'lte', 'eq', 'range')
  ),
  constraint floor_member_preferences_leaderboard_display_check check (
    leaderboard_display in ('username', 'full_name')
  )
);

comment on table public.floor_member_preferences is
  'Per-member Floor settings: alerts, display defaults, and the leaderboard privacy opt-out. Unlike floor_subscriptions, this is user-writable -- RLS scopes every write to the owning member.';

drop trigger if exists touch_floor_member_preferences_updated_at on public.floor_member_preferences;
create trigger touch_floor_member_preferences_updated_at
before update on public.floor_member_preferences
for each row execute function public.touch_floor_updated_at();

alter table public.floor_member_preferences enable row level security;

drop policy if exists "Members read their own Floor preferences" on public.floor_member_preferences;
create policy "Members read their own Floor preferences"
on public.floor_member_preferences for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Members create their own Floor preferences" on public.floor_member_preferences;
create policy "Members create their own Floor preferences"
on public.floor_member_preferences for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Members update their own Floor preferences" on public.floor_member_preferences;
create policy "Members update their own Floor preferences"
on public.floor_member_preferences for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on table public.floor_member_preferences from anon;
revoke all on table public.floor_member_preferences from authenticated;
revoke all on table public.floor_member_preferences from service_role;

grant select, insert, update on table public.floor_member_preferences to authenticated;
-- service_role: read-only. The only planned service-role consumers are
-- future alert/digest jobs deciding who to notify -- none of them need to
-- write a member's own preferences back.
grant select on table public.floor_member_preferences to service_role;

alter table public.floor_member_preferences replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'floor_member_preferences'
  ) then
    execute 'alter publication supabase_realtime add table public.floor_member_preferences';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
