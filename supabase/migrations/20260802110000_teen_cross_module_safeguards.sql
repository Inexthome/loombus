-- Issue #680 / #683: cross-module teen safeguards for Rooms and discovery.

begin;

create table if not exists public.room_minor_safety_settings (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  allows_minors boolean not null default false,
  minor_admission_mode text not null default 'blocked',
  configured_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_minor_admission_mode_check check (
    minor_admission_mode in ('blocked', 'approval_required')
  ),
  constraint room_minor_admission_consistency_check check (
    (allows_minors = false and minor_admission_mode = 'blocked')
    or
    (allows_minors = true and minor_admission_mode = 'approval_required')
  )
);

create index if not exists room_minor_safety_allows_idx
  on public.room_minor_safety_settings(allows_minors, updated_at desc);

create or replace function public.touch_room_minor_safety_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.allows_minors then
    new.minor_admission_mode := 'approval_required';
  else
    new.minor_admission_mode := 'blocked';
  end if;
  return new;
end;
$$;

create or replace function public.initialize_room_minor_safety_settings()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  classroom_room boolean;
begin
  classroom_room := lower(
    coalesce(new.room_type::text, new.template_key::text, '')
  ) like '%classroom%';

  insert into public.room_minor_safety_settings (
    room_id,
    allows_minors,
    minor_admission_mode,
    configured_by
  ) values (
    new.id,
    classroom_room,
    case when classroom_room then 'approval_required' else 'blocked' end,
    coalesce(new.owner_id, new.created_by)
  )
  on conflict (room_id) do nothing;

  return new;
end;
$$;

create or replace function public.enforce_adult_room_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  candidate_id uuid;
  candidate_age text;
  candidate_guardian boolean;
begin
  candidate_id := coalesce(new.owner_id, new.created_by);
  if candidate_id is null then
    raise exception 'A Room requires an eligible adult owner.' using errcode = '42501';
  end if;

  select age_band, coalesce(guardian_required, false)
  into candidate_age, candidate_guardian
  from public.profile_sensitive
  where id = candidate_id;

  if candidate_age is distinct from 'adult' or candidate_guardian then
    raise exception 'Room ownership is currently limited to adult accounts.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_room_application_age_safety()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  applicant_age text;
  applicant_guardian boolean;
  room_allows_minors boolean;
begin
  select age_band, coalesce(guardian_required, false)
  into applicant_age, applicant_guardian
  from public.profile_sensitive
  where id = new.applicant_id;

  if applicant_age is null or applicant_age = 'unknown' then
    raise exception 'Complete age safety before requesting Room admission.'
      using errcode = '42501';
  end if;

  if applicant_age = 'under_13' or applicant_guardian then
    raise exception 'This account is not eligible to use Loombus.'
      using errcode = '42501';
  end if;

  if applicant_age = 'teen' then
    select allows_minors
    into room_allows_minors
    from public.room_minor_safety_settings
    where room_id = new.room_id;

    if coalesce(room_allows_minors, false) = false then
      raise exception 'This Room is not configured to admit teen members.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_room_membership_age_safety()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  member_age text;
  member_guardian boolean;
  room_allows_minors boolean;
  admission_mode text;
  normalized_role text;
  normalized_status text;
begin
  normalized_role := lower(coalesce(new.role::text, 'member'));
  normalized_status := lower(coalesce(new.status::text, 'active'));

  if normalized_status in ('blocked', 'removed', 'inactive') then
    return new;
  end if;

  select age_band, coalesce(guardian_required, false)
  into member_age, member_guardian
  from public.profile_sensitive
  where id = new.user_id;

  if member_age is null or member_age = 'unknown' then
    raise exception 'Complete age safety before joining a Room.'
      using errcode = '42501';
  end if;

  if member_age = 'under_13' or member_guardian then
    raise exception 'This account is not eligible to use Loombus.'
      using errcode = '42501';
  end if;

  if member_age = 'teen' then
    select allows_minors, minor_admission_mode
    into room_allows_minors, admission_mode
    from public.room_minor_safety_settings
    where room_id = new.room_id;

    if coalesce(room_allows_minors, false) = false then
      raise exception 'This Room is not configured to admit teen members.'
        using errcode = '42501';
    end if;

    if normalized_role not in ('member') then
      raise exception 'Teen Room members cannot hold owner, administrator, or moderator roles.'
        using errcode = '42501';
    end if;

    if normalized_status = 'active'
       and coalesce(admission_mode, 'blocked') = 'approval_required'
       and not exists (
         select 1
         from public.room_applications application
         where application.room_id = new.room_id
           and application.applicant_id = new.user_id
           and application.state in ('pending', 'approved')
       ) then
      raise exception 'Teen Room admission requires an approved join-request workflow.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

insert into public.room_minor_safety_settings (
  room_id,
  allows_minors,
  minor_admission_mode,
  configured_by
)
select
  room.id,
  lower(coalesce(room.room_type::text, room.template_key::text, '')) like '%classroom%',
  case
    when lower(coalesce(room.room_type::text, room.template_key::text, '')) like '%classroom%'
      then 'approval_required'
    else 'blocked'
  end,
  coalesce(room.owner_id, room.created_by)
from public.rooms room
on conflict (room_id) do nothing;

drop trigger if exists touch_room_minor_safety_updated_at_trigger
  on public.room_minor_safety_settings;
create trigger touch_room_minor_safety_updated_at_trigger
before insert or update on public.room_minor_safety_settings
for each row execute function public.touch_room_minor_safety_updated_at();

drop trigger if exists initialize_room_minor_safety_settings_trigger
  on public.rooms;
create trigger initialize_room_minor_safety_settings_trigger
after insert on public.rooms
for each row execute function public.initialize_room_minor_safety_settings();

drop trigger if exists enforce_adult_room_ownership_trigger
  on public.rooms;
create trigger enforce_adult_room_ownership_trigger
before insert or update of owner_id, created_by on public.rooms
for each row execute function public.enforce_adult_room_ownership();

drop trigger if exists enforce_room_application_age_safety_trigger
  on public.room_applications;
create trigger enforce_room_application_age_safety_trigger
before insert or update of applicant_id, room_id, state on public.room_applications
for each row execute function public.enforce_room_application_age_safety();

drop trigger if exists enforce_room_membership_age_safety_trigger
  on public.room_members;
create trigger enforce_room_membership_age_safety_trigger
before insert or update of user_id, room_id, role, status on public.room_members
for each row execute function public.enforce_room_membership_age_safety();

alter table public.room_minor_safety_settings enable row level security;
revoke all on table public.room_minor_safety_settings from anon, authenticated;

revoke all on function public.touch_room_minor_safety_updated_at() from public, anon, authenticated;
revoke all on function public.initialize_room_minor_safety_settings() from public, anon, authenticated;
revoke all on function public.enforce_adult_room_ownership() from public, anon, authenticated;
revoke all on function public.enforce_room_application_age_safety() from public, anon, authenticated;
revoke all on function public.enforce_room_membership_age_safety() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
