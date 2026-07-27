-- Issue #666 phase 1: database-backed teen age state, privacy defaults,
-- age correction, underage reporting, and private-conversation eligibility.

begin;

create table if not exists public.teen_safety_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  future_discussion_audience text not null default 'followers',
  allow_unsolicited_adult_contact boolean not null default false,
  personalized_recommendations_enabled boolean not null default false,
  commerce_discovery_enabled boolean not null default false,
  defaults_applied_at timestamptz,
  age_transitioned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teen_safety_future_audience_check check (
    future_discussion_audience in ('followers', 'connections', 'only_me')
  )
);

create table if not exists public.age_correction_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_age_band text not null,
  requested_date_of_birth date not null,
  requested_age_band text not null,
  reason text not null,
  status text not null default 'submitted',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint age_correction_current_band_check check (
    current_age_band in ('unknown', 'under_13', 'teen', 'adult')
  ),
  constraint age_correction_requested_band_check check (
    requested_age_band in ('under_13', 'teen', 'adult')
  ),
  constraint age_correction_status_check check (
    status in ('submitted', 'reviewing', 'approved', 'denied', 'cancelled')
  ),
  constraint age_correction_reason_length_check check (
    char_length(reason) between 10 and 1000
  ),
  constraint age_correction_resolution_length_check check (
    resolution_note is null or char_length(resolution_note) <= 2000
  )
);

create unique index if not exists age_correction_one_open_request_idx
  on public.age_correction_requests(user_id)
  where status in ('submitted', 'reviewing');

create index if not exists age_correction_status_created_idx
  on public.age_correction_requests(status, created_at desc);

create table if not exists public.underage_account_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  context text,
  status text not null default 'new',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint underage_report_not_self check (reporter_id <> reported_user_id),
  constraint underage_report_reason_check check (
    reason in ('appears_under_13', 'self_disclosed_under_13', 'guardian_report', 'other')
  ),
  constraint underage_report_status_check check (
    status in ('new', 'reviewing', 'actioned', 'dismissed')
  ),
  constraint underage_report_context_length_check check (
    context is null or char_length(context) <= 2000
  ),
  constraint underage_report_resolution_length_check check (
    resolution_note is null or char_length(resolution_note) <= 2000
  )
);

create unique index if not exists underage_report_open_pair_idx
  on public.underage_account_reports(reporter_id, reported_user_id)
  where status in ('new', 'reviewing');

create index if not exists underage_report_status_created_idx
  on public.underage_account_reports(status, created_at desc);

create or replace function public.compute_loombus_age_band(p_date_of_birth date)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  computed_age integer;
begin
  if p_date_of_birth is null or p_date_of_birth > current_date then
    return null;
  end if;

  computed_age := extract(year from age(current_date, p_date_of_birth));

  if computed_age < 0 or computed_age > 120 then
    return null;
  end if;

  if computed_age < 13 then
    return 'under_13';
  elsif computed_age < 18 then
    return 'teen';
  end if;

  return 'adult';
end;
$$;

create or replace function public.enforce_profile_sensitive_age_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_band text;
begin
  derived_band := public.compute_loombus_age_band(new.date_of_birth);

  if derived_band is null then
    raise exception 'Invalid date of birth.' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE'
     and old.date_of_birth is not null
     and new.date_of_birth is distinct from old.date_of_birth
     and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Date of birth changes require the protected correction workflow.'
      using errcode = '42501';
  end if;

  new.age_band := derived_band;
  new.teen_safety_mode := derived_band in ('under_13', 'teen');
  new.guardian_required := derived_band = 'under_13';

  return new;
end;
$$;

create or replace function public.apply_teen_defaults_for_user(p_user_id uuid, p_age_band text)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.teen_safety_settings (
    user_id,
    future_discussion_audience,
    allow_unsolicited_adult_contact,
    personalized_recommendations_enabled,
    commerce_discovery_enabled,
    defaults_applied_at
  ) values (
    p_user_id,
    'followers',
    false,
    false,
    false,
    case when p_age_band = 'teen' then now() else null end
  )
  on conflict (user_id) do update
  set
    updated_at = now(),
    defaults_applied_at = case
      when p_age_band = 'teen' and public.teen_safety_settings.defaults_applied_at is null
        then now()
      else public.teen_safety_settings.defaults_applied_at
    end;

  if p_age_band = 'teen' then
    insert into public.member_privacy_settings (
      user_id,
      private_account,
      discoverable,
      show_view_identity
    ) values (
      p_user_id,
      true,
      false,
      true
    )
    on conflict (user_id) do update
    set
      private_account = true,
      discoverable = false,
      updated_at = now();
  end if;
end;
$$;

create or replace function public.sync_teen_defaults_after_age_change()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  perform public.apply_teen_defaults_for_user(new.id, new.age_band);

  if tg_op = 'UPDATE'
     and old.age_band = 'teen'
     and new.age_band = 'adult' then
    update public.teen_safety_settings
    set age_transitioned_at = coalesce(age_transitioned_at, now()),
        updated_at = now()
    where user_id = new.id;
  end if;

  return new;
end;
$$;

create or replace function public.refresh_age_bands_and_preserve_privacy()
returns table(updated_count integer)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  changed integer := 0;
begin
  update public.profile_sensitive ps
  set
    age_band = public.compute_loombus_age_band(ps.date_of_birth),
    teen_safety_mode = public.compute_loombus_age_band(ps.date_of_birth) in ('under_13', 'teen'),
    guardian_required = public.compute_loombus_age_band(ps.date_of_birth) = 'under_13'
  where ps.date_of_birth is not null
    and ps.age_band is distinct from public.compute_loombus_age_band(ps.date_of_birth);

  get diagnostics changed = row_count;
  return query select changed;
end;
$$;

create or replace function public.can_start_private_conversation(
  p_sender_id uuid,
  p_recipient_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  sender_age text;
  recipient_age text;
  sender_guardian boolean := false;
  recipient_guardian boolean := false;
  sender_status text;
  recipient_status text;
begin
  if p_sender_id is null or p_recipient_id is null or p_sender_id = p_recipient_id then
    return false;
  end if;

  select ps.age_band, coalesce(ps.guardian_required, false), p.account_status
  into sender_age, sender_guardian, sender_status
  from public.profiles p
  left join public.profile_sensitive ps on ps.id = p.id
  where p.id = p_sender_id;

  select ps.age_band, coalesce(ps.guardian_required, false), p.account_status
  into recipient_age, recipient_guardian, recipient_status
  from public.profiles p
  left join public.profile_sensitive ps on ps.id = p.id
  where p.id = p_recipient_id;

  if coalesce(sender_status, 'active') not in ('active', 'warned')
     or coalesce(recipient_status, 'active') not in ('active', 'warned') then
    return false;
  end if;

  if sender_age not in ('teen', 'adult')
     or recipient_age not in ('teen', 'adult')
     or sender_guardian
     or recipient_guardian then
    return false;
  end if;

  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = p_sender_id and b.blocked_id = p_recipient_id)
       or (b.blocker_id = p_recipient_id and b.blocked_id = p_sender_id)
  ) then
    return false;
  end if;

  return exists (
    select 1
    from public.follows f1
    join public.follows f2
      on f2.follower_id = p_recipient_id
     and f2.following_id = p_sender_id
    where f1.follower_id = p_sender_id
      and f1.following_id = p_recipient_id
  );
end;
$$;

create or replace function public.enforce_private_conversation_age_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  creator_id uuid;
begin
  select created_by into creator_id
  from public.private_conversations
  where id = new.conversation_id;

  if creator_id is null or new.user_id = creator_id then
    return new;
  end if;

  if not public.can_start_private_conversation(creator_id, new.user_id) then
    raise exception 'Private conversation is not eligible under account, age-safety, relationship, or block rules.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.touch_teen_safety_workflow_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_profile_sensitive_age_state_trigger
  on public.profile_sensitive;
create trigger enforce_profile_sensitive_age_state_trigger
before insert or update of date_of_birth on public.profile_sensitive
for each row execute function public.enforce_profile_sensitive_age_state();

drop trigger if exists sync_teen_defaults_after_age_change_trigger
  on public.profile_sensitive;
create trigger sync_teen_defaults_after_age_change_trigger
after insert or update of age_band on public.profile_sensitive
for each row execute function public.sync_teen_defaults_after_age_change();

drop trigger if exists enforce_private_conversation_age_eligibility_trigger
  on public.private_conversation_members;
create trigger enforce_private_conversation_age_eligibility_trigger
before insert on public.private_conversation_members
for each row execute function public.enforce_private_conversation_age_eligibility();

drop trigger if exists touch_teen_safety_settings_updated_at_trigger
  on public.teen_safety_settings;
create trigger touch_teen_safety_settings_updated_at_trigger
before update on public.teen_safety_settings
for each row execute function public.touch_teen_safety_workflow_updated_at();

drop trigger if exists touch_age_correction_requests_updated_at_trigger
  on public.age_correction_requests;
create trigger touch_age_correction_requests_updated_at_trigger
before update on public.age_correction_requests
for each row execute function public.touch_teen_safety_workflow_updated_at();

drop trigger if exists touch_underage_account_reports_updated_at_trigger
  on public.underage_account_reports;
create trigger touch_underage_account_reports_updated_at_trigger
before update on public.underage_account_reports
for each row execute function public.touch_teen_safety_workflow_updated_at();

insert into public.teen_safety_settings (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

select public.apply_teen_defaults_for_user(ps.id, ps.age_band)
from public.profile_sensitive ps
where ps.age_band = 'teen';

alter table public.teen_safety_settings enable row level security;
alter table public.age_correction_requests enable row level security;
alter table public.underage_account_reports enable row level security;

revoke all on table public.teen_safety_settings from anon, authenticated;
revoke all on table public.age_correction_requests from anon, authenticated;
revoke all on table public.underage_account_reports from anon, authenticated;

grant select on table public.teen_safety_settings to authenticated;
grant select on table public.age_correction_requests to authenticated;

drop policy if exists teen_safety_settings_owner_select
  on public.teen_safety_settings;
create policy teen_safety_settings_owner_select
on public.teen_safety_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists age_correction_owner_select
  on public.age_correction_requests;
create policy age_correction_owner_select
on public.age_correction_requests
for select
to authenticated
using (auth.uid() = user_id);

revoke all on function public.compute_loombus_age_band(date) from public, anon, authenticated;
revoke all on function public.enforce_profile_sensitive_age_state() from public, anon, authenticated;
revoke all on function public.apply_teen_defaults_for_user(uuid, text) from public, anon, authenticated;
revoke all on function public.sync_teen_defaults_after_age_change() from public, anon, authenticated;
revoke all on function public.refresh_age_bands_and_preserve_privacy() from public, anon, authenticated;
revoke all on function public.can_start_private_conversation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.enforce_private_conversation_age_eligibility() from public, anon, authenticated;
revoke all on function public.touch_teen_safety_workflow_updated_at() from public, anon, authenticated;

grant execute on function public.can_start_private_conversation(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
