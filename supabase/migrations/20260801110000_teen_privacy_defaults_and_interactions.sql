-- Loombus teen privacy defaults and age-aware interaction contract.
-- Apply after the enforcement-history migrations and member-privacy migration.

begin;

create or replace function public.loombus_age_on_date(
  p_date_of_birth date,
  p_on_date date default current_date
)
returns integer
language sql
immutable
strict
as $$
  select extract(year from age(p_on_date, p_date_of_birth))::integer;
$$;

create or replace function public.loombus_age_band(
  p_date_of_birth date,
  p_on_date date default current_date
)
returns text
language sql
immutable
strict
as $$
  select case
    when public.loombus_age_on_date(p_date_of_birth, p_on_date) < 13 then 'under_13'
    when public.loombus_age_on_date(p_date_of_birth, p_on_date) < 18 then 'teen'
    else 'adult'
  end;
$$;

alter table public.profile_sensitive
  add column if not exists age_state text not null default 'unknown',
  add column if not exists age_declared_at timestamptz,
  add column if not exists age_last_confirmed_at timestamptz,
  add column if not exists turns_18_at date,
  add column if not exists age_transitioned_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profile_sensitive
  drop constraint if exists profile_sensitive_age_state_check;

alter table public.profile_sensitive
  add constraint profile_sensitive_age_state_check
  check (
    age_state in (
      'unknown',
      'teen',
      'adult',
      'correction_pending',
      'ineligible'
    )
  );

create or replace function public.normalize_profile_sensitive_age()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  computed_band text;
begin
  new.updated_at := now();

  if new.date_of_birth is null then
    new.age_band := 'unknown';
    new.teen_safety_mode := false;
    new.guardian_required := false;
    new.age_state := 'unknown';
    new.turns_18_at := null;
    return new;
  end if;

  computed_band := public.loombus_age_band(new.date_of_birth::date, current_date);
  new.age_band := computed_band;
  new.teen_safety_mode := computed_band = 'teen';
  new.guardian_required := computed_band = 'under_13';
  new.age_state := case
    when computed_band = 'under_13' then 'ineligible'
    when computed_band = 'teen' then 'teen'
    else 'adult'
  end;
  new.turns_18_at := (new.date_of_birth::date + interval '18 years')::date;
  new.age_last_confirmed_at := coalesce(new.age_last_confirmed_at, now());

  if tg_op = 'INSERT' or old.date_of_birth is distinct from new.date_of_birth then
    new.age_declared_at := coalesce(new.age_declared_at, now());
    new.age_last_confirmed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_profile_sensitive_age_trigger
  on public.profile_sensitive;
create trigger normalize_profile_sensitive_age_trigger
before insert or update of date_of_birth
on public.profile_sensitive
for each row execute function public.normalize_profile_sensitive_age();

update public.profile_sensitive
set date_of_birth = date_of_birth
where date_of_birth is not null;

update public.profile_sensitive
set
  age_state = 'unknown',
  age_band = 'unknown',
  teen_safety_mode = false,
  guardian_required = false,
  turns_18_at = null,
  updated_at = now()
where date_of_birth is null;

create table if not exists public.age_correction_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  current_date_of_birth date,
  requested_date_of_birth date not null,
  member_reason text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint age_correction_requests_status_check
    check (status in ('pending', 'reviewing', 'approved', 'denied', 'cancelled')),
  constraint age_correction_requests_reason_length
    check (member_reason is null or char_length(member_reason) <= 2000),
  constraint age_correction_requests_note_length
    check (decision_note is null or char_length(decision_note) <= 4000)
);

create unique index if not exists age_correction_requests_one_open_idx
  on public.age_correction_requests(user_id)
  where status in ('pending', 'reviewing');
create index if not exists age_correction_requests_queue_idx
  on public.age_correction_requests(status, created_at);

create table if not exists public.underage_account_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  details text,
  status text not null default 'new',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint underage_account_reports_not_self
    check (reporter_id <> reported_user_id),
  constraint underage_account_reports_status_check
    check (status in ('new', 'reviewing', 'confirmed', 'not_confirmed', 'closed')),
  constraint underage_account_reports_details_length
    check (details is null or char_length(details) <= 2000),
  constraint underage_account_reports_note_length
    check (resolution_note is null or char_length(resolution_note) <= 4000)
);

create unique index if not exists underage_account_reports_one_open_pair_idx
  on public.underage_account_reports(reporter_id, reported_user_id)
  where status in ('new', 'reviewing');
create index if not exists underage_account_reports_queue_idx
  on public.underage_account_reports(status, created_at);

create table if not exists public.teen_contact_permissions (
  teen_user_id uuid not null references public.profiles(id) on delete cascade,
  adult_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'allowed',
  source text not null,
  source_id uuid,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (teen_user_id, adult_user_id),
  constraint teen_contact_permissions_not_self
    check (teen_user_id <> adult_user_id),
  constraint teen_contact_permissions_status_check
    check (status in ('allowed', 'revoked')),
  constraint teen_contact_permissions_source_check
    check (source in ('teen_started_conversation', 'teen_sent_message', 'legacy_teen_initiated', 'admin_review'))
);

create table if not exists public.room_minor_safety_settings (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  allows_minors boolean not null default false,
  requires_staff_approval boolean not null default true,
  adult_contact_mode text not null default 'teen_initiated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_minor_safety_contact_mode_check
    check (adult_contact_mode in ('teen_initiated', 'disabled')),
  constraint room_minor_safety_approval_check
    check (requires_staff_approval = true)
);

create table if not exists public.teen_safety_review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  reason_code text not null,
  status text not null default 'open',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teen_safety_review_items_status_check
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint teen_safety_review_items_note_length
    check (resolution_note is null or char_length(resolution_note) <= 4000)
);

create unique index if not exists teen_safety_review_items_open_source_idx
  on public.teen_safety_review_items(user_id, source_type, source_id, reason_code)
  where status in ('open', 'reviewing');
create index if not exists teen_safety_review_items_queue_idx
  on public.teen_safety_review_items(status, created_at);

alter table public.age_correction_requests enable row level security;
alter table public.underage_account_reports enable row level security;
alter table public.teen_contact_permissions enable row level security;
alter table public.room_minor_safety_settings enable row level security;
alter table public.teen_safety_review_items enable row level security;

revoke all on table public.age_correction_requests from public, anon, authenticated;
revoke all on table public.underage_account_reports from public, anon, authenticated;
revoke all on table public.teen_contact_permissions from public, anon, authenticated;
revoke all on table public.room_minor_safety_settings from public, anon, authenticated;
revoke all on table public.teen_safety_review_items from public, anon, authenticated;

grant all on table public.age_correction_requests to service_role;
grant all on table public.underage_account_reports to service_role;
grant all on table public.teen_contact_permissions to service_role;
grant all on table public.room_minor_safety_settings to service_role;
grant all on table public.teen_safety_review_items to service_role;

-- Age data remains owner-readable, but all mutation moves behind server routes.
revoke insert, update, delete on table public.profile_sensitive from authenticated;
grant select on table public.profile_sensitive to authenticated;

create or replace function public.apply_teen_member_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_band text;
begin
  select coalesce(age_band, 'unknown')
  into current_band
  from public.profile_sensitive
  where id = p_user_id;

  if current_band <> 'teen' then
    return;
  end if;

  insert into public.member_privacy_settings (
    user_id,
    private_account,
    discoverable,
    show_view_identity,
    updated_at
  ) values (
    p_user_id,
    true,
    false,
    false,
    now()
  )
  on conflict (user_id) do update set
    private_account = true,
    discoverable = false,
    show_view_identity = false,
    updated_at = now();

  insert into public.discussion_audience_preferences (
    user_id,
    default_audience_type,
    default_audience_base,
    include_user_ids,
    exclude_user_ids,
    updated_at
  ) values (
    p_user_id,
    'followers',
    null,
    '{}'::uuid[],
    '{}'::uuid[],
    now()
  )
  on conflict (user_id) do nothing;

  update public.discussion_audience_preferences
  set
    default_audience_type = 'followers',
    default_audience_base = null,
    include_user_ids = '{}'::uuid[],
    exclude_user_ids = '{}'::uuid[],
    updated_at = now()
  where user_id = p_user_id
    and (
      default_audience_type in ('public', 'exclude_selected')
      or (
        default_audience_type = 'custom'
        and coalesce(default_audience_base, 'public') = 'public'
      )
    );
end;
$$;

create or replace function public.apply_teen_defaults_after_age_change()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.age_band = 'teen' then
    perform public.apply_teen_member_defaults(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists apply_teen_defaults_after_age_change_trigger
  on public.profile_sensitive;
create trigger apply_teen_defaults_after_age_change_trigger
after insert or update of date_of_birth
on public.profile_sensitive
for each row execute function public.apply_teen_defaults_after_age_change();

select public.apply_teen_member_defaults(id)
from public.profile_sensitive
where age_band = 'teen';

create or replace function public.enforce_teen_private_account()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if exists (
    select 1
    from public.profile_sensitive sensitive
    where sensitive.id = new.user_id
      and sensitive.age_band = 'teen'
  ) then
    new.private_account := true;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enforce_teen_private_account_trigger
  on public.member_privacy_settings;
create trigger enforce_teen_private_account_trigger
before insert or update
on public.member_privacy_settings
for each row execute function public.enforce_teen_private_account();

create or replace function public.enforce_teen_discussion_preference()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not exists (
    select 1
    from public.profile_sensitive sensitive
    where sensitive.id = new.user_id
      and sensitive.age_band = 'teen'
  ) then
    return new;
  end if;

  if new.default_audience_type in ('public', 'exclude_selected') then
    new.default_audience_type := 'followers';
    new.default_audience_base := null;
    new.include_user_ids := '{}'::uuid[];
    new.exclude_user_ids := '{}'::uuid[];
  elsif new.default_audience_type = 'custom'
    and coalesce(new.default_audience_base, 'public') = 'public'
  then
    new.default_audience_base := 'followers';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists aa_enforce_teen_discussion_preference_trigger
  on public.discussion_audience_preferences;
create trigger aa_enforce_teen_discussion_preference_trigger
before insert or update
on public.discussion_audience_preferences
for each row execute function public.enforce_teen_discussion_preference();

create or replace function public.enforce_teen_discussion_insert()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if exists (
    select 1
    from public.profile_sensitive sensitive
    where sensitive.id = new.user_id
      and sensitive.age_band = 'teen'
  ) then
    if coalesce(new.audience_type, 'public') in ('public', 'exclude_selected') then
      new.audience_type := 'followers';
      new.audience_base := null;
    elsif new.audience_type = 'custom'
      and coalesce(new.audience_base, 'public') = 'public'
    then
      new.audience_base := 'followers';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_enforce_teen_discussion_insert_trigger
  on public.discussions;
create trigger zz_enforce_teen_discussion_insert_trigger
before insert
on public.discussions
for each row execute function public.enforce_teen_discussion_insert();

insert into public.teen_safety_review_items (
  user_id,
  source_type,
  source_id,
  reason_code
)
select
  discussion.user_id,
  'discussion',
  discussion.id,
  'LEGACY_PUBLIC_TEEN_DISCUSSION'
from public.discussions discussion
join public.profile_sensitive sensitive on sensitive.id = discussion.user_id
where sensitive.age_band = 'teen'
  and coalesce(discussion.audience_type, 'public') = 'public'
  and discussion.deleted_at is null
on conflict do nothing;

create or replace function public.declare_member_age(
  p_user_id uuid,
  p_date_of_birth date
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  existing_row public.profile_sensitive%rowtype;
  computed_band text;
begin
  if p_user_id is null or p_date_of_birth is null then
    raise exception 'INVALID_DATE_OF_BIRTH' using errcode = 'P0001';
  end if;

  if p_date_of_birth > current_date
    or p_date_of_birth < current_date - interval '120 years'
  then
    raise exception 'INVALID_DATE_OF_BIRTH' using errcode = 'P0001';
  end if;

  computed_band := public.loombus_age_band(p_date_of_birth, current_date);
  if computed_band = 'under_13' then
    raise exception 'ACCOUNT_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  select *
  into existing_row
  from public.profile_sensitive
  where id = p_user_id
  for update;

  if found and existing_row.date_of_birth is not null
    and existing_row.date_of_birth::date <> p_date_of_birth
  then
    raise exception 'AGE_CORRECTION_REQUIRED' using errcode = 'P0001';
  end if;

  insert into public.profile_sensitive (
    id,
    date_of_birth,
    age_declared_at,
    age_last_confirmed_at
  ) values (
    p_user_id,
    p_date_of_birth,
    now(),
    now()
  )
  on conflict (id) do update set
    date_of_birth = excluded.date_of_birth,
    age_last_confirmed_at = now(),
    updated_at = now();

  perform public.apply_teen_member_defaults(p_user_id);

  return jsonb_build_object(
    'ok', true,
    'ageBand', computed_band,
    'teenSafetyMode', computed_band = 'teen',
    'turns18At', (p_date_of_birth + interval '18 years')::date
  );
end;
$$;

revoke all on function public.declare_member_age(uuid, date)
  from public, anon, authenticated;
grant execute on function public.declare_member_age(uuid, date)
  to service_role;

create or replace function public.refresh_due_age_transitions()
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  changed_count integer := 0;
begin
  update public.profile_sensitive
  set
    date_of_birth = date_of_birth,
    age_transitioned_at = now(),
    updated_at = now()
  where age_band = 'teen'
    and turns_18_at is not null
    and turns_18_at <= current_date;

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

revoke all on function public.refresh_due_age_transitions()
  from public, anon, authenticated;
grant execute on function public.refresh_due_age_transitions()
  to service_role;

create or replace function public.is_established_member_relationship(
  p_first_user_id uuid,
  p_second_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_first_user_id is null or p_second_user_id is null then
    return false;
  end if;

  if p_first_user_id = p_second_user_id then
    return true;
  end if;

  if exists (
    select 1
    from public.user_blocks block
    where (
      block.blocker_id = p_first_user_id
      and block.blocked_id = p_second_user_id
    ) or (
      block.blocker_id = p_second_user_id
      and block.blocked_id = p_first_user_id
    )
  ) then
    return false;
  end if;

  if exists (
    select 1
    from public.follows relationship
    where (
      relationship.follower_id = p_first_user_id
      and relationship.following_id = p_second_user_id
    ) or (
      relationship.follower_id = p_second_user_id
      and relationship.following_id = p_first_user_id
    )
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.room_members first_membership
    join public.room_members second_membership
      on second_membership.room_id = first_membership.room_id
    where first_membership.user_id = p_first_user_id
      and second_membership.user_id = p_second_user_id
      and coalesce(first_membership.status, 'active') not in ('blocked', 'removed', 'inactive')
      and coalesce(second_membership.status, 'active') not in ('blocked', 'removed', 'inactive')
      and (
        first_membership.suspended_until is null
        or first_membership.suspended_until <= now()
      )
      and (
        second_membership.suspended_until is null
        or second_membership.suspended_until <= now()
      )
  );
end;
$$;

create or replace function public.can_discover_teen_profile(
  p_viewer_user_id uuid,
  p_target_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  target_band text := 'unknown';
  viewer_band text := 'unknown';
  viewer_admin boolean := false;
begin
  if p_target_user_id is null then
    return false;
  end if;

  if p_viewer_user_id = p_target_user_id then
    return true;
  end if;

  select coalesce(age_band, 'unknown')
  into target_band
  from public.profile_sensitive
  where id = p_target_user_id;

  if target_band <> 'teen' then
    return true;
  end if;

  if p_viewer_user_id is null then
    return false;
  end if;

  select coalesce(is_admin, false)
  into viewer_admin
  from public.profiles
  where id = p_viewer_user_id;

  if viewer_admin then
    return true;
  end if;

  select coalesce(age_band, 'unknown')
  into viewer_band
  from public.profile_sensitive
  where id = p_viewer_user_id;

  if viewer_band = 'teen' then
    return not exists (
      select 1
      from public.user_blocks block
      where (
        block.blocker_id = p_viewer_user_id
        and block.blocked_id = p_target_user_id
      ) or (
        block.blocker_id = p_target_user_id
        and block.blocked_id = p_viewer_user_id
      )
    );
  end if;

  return public.is_established_member_relationship(
    p_viewer_user_id,
    p_target_user_id
  );
end;
$$;

revoke all on function public.is_established_member_relationship(uuid, uuid)
  from public, anon;
revoke all on function public.can_discover_teen_profile(uuid, uuid)
  from public, anon;
grant execute on function public.is_established_member_relationship(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.can_discover_teen_profile(uuid, uuid)
  to authenticated, service_role;

create or replace function public.enforce_teen_follow_request()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  requester_band text := 'unknown';
  target_band text := 'unknown';
begin
  select coalesce(age_band, 'unknown')
  into requester_band
  from public.profile_sensitive
  where id = new.requester_id;

  select coalesce(age_band, 'unknown')
  into target_band
  from public.profile_sensitive
  where id = new.target_id;

  if requester_band = 'under_13' or target_band = 'under_13' then
    raise exception 'ACCOUNT_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  if requester_band = 'adult'
    and target_band = 'teen'
    and not public.is_established_member_relationship(new.requester_id, new.target_id)
  then
    raise exception 'TEEN_FOLLOW_RELATIONSHIP_REQUIRED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_teen_follow_request_trigger
  on public.follow_requests;
create trigger enforce_teen_follow_request_trigger
before insert
on public.follow_requests
for each row execute function public.enforce_teen_follow_request();

create or replace function public.enforce_teen_follow_insert()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if exists (
    select 1
    from public.profile_sensitive sensitive
    where sensitive.id = new.following_id
      and sensitive.age_band = 'teen'
  ) and not exists (
    select 1
    from public.follow_requests request
    where request.requester_id = new.follower_id
      and request.target_id = new.following_id
      and request.status = 'accepted'
  ) then
    raise exception 'TEEN_FOLLOW_APPROVAL_REQUIRED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_teen_follow_insert_trigger
  on public.follows;
create trigger enforce_teen_follow_insert_trigger
before insert
on public.follows
for each row execute function public.enforce_teen_follow_insert();

create or replace function public.enforce_teen_conversation_membership()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  participant_count integer := 0;
  teen_id uuid;
  adult_id uuid;
  creator_id uuid;
begin
  select count(*)
  into participant_count
  from public.private_conversation_members member
  where member.conversation_id = new.conversation_id
    and member.deleted_at is null;

  if participant_count <> 2 then
    return new;
  end if;

  select
    max(member.user_id) filter (where sensitive.age_band = 'teen'),
    max(member.user_id) filter (where sensitive.age_band = 'adult')
  into teen_id, adult_id
  from public.private_conversation_members member
  join public.profile_sensitive sensitive on sensitive.id = member.user_id
  where member.conversation_id = new.conversation_id
    and member.deleted_at is null;

  if teen_id is null or adult_id is null then
    return new;
  end if;

  select created_by
  into creator_id
  from public.private_conversations
  where id = new.conversation_id;

  if creator_id = adult_id and not exists (
    select 1
    from public.teen_contact_permissions permission
    where permission.teen_user_id = teen_id
      and permission.adult_user_id = adult_id
      and permission.status = 'allowed'
  ) then
    raise exception 'A teen must start this private conversation.'
      using errcode = 'P0001';
  end if;

  if creator_id = teen_id then
    insert into public.teen_contact_permissions (
      teen_user_id,
      adult_user_id,
      status,
      source,
      source_id,
      granted_at,
      revoked_at,
      updated_at
    ) values (
      teen_id,
      adult_id,
      'allowed',
      'teen_started_conversation',
      new.conversation_id,
      now(),
      null,
      now()
    )
    on conflict (teen_user_id, adult_user_id) do update set
      status = 'allowed',
      source = 'teen_started_conversation',
      source_id = excluded.source_id,
      granted_at = now(),
      revoked_at = null,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_teen_conversation_membership_trigger
  on public.private_conversation_members;
create trigger enforce_teen_conversation_membership_trigger
after insert or update of deleted_at
on public.private_conversation_members
for each row execute function public.enforce_teen_conversation_membership();

create or replace function public.enforce_teen_private_message()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  recipient_id uuid;
  sender_band text := 'unknown';
  recipient_band text := 'unknown';
begin
  select member.user_id
  into recipient_id
  from public.private_conversation_members member
  where member.conversation_id = new.conversation_id
    and member.user_id <> new.sender_id
    and member.deleted_at is null
  limit 1;

  if recipient_id is null then
    return new;
  end if;

  select coalesce(age_band, 'unknown')
  into sender_band
  from public.profile_sensitive
  where id = new.sender_id;

  select coalesce(age_band, 'unknown')
  into recipient_band
  from public.profile_sensitive
  where id = recipient_id;

  if sender_band not in ('teen', 'adult')
    or recipient_band not in ('teen', 'adult')
  then
    raise exception 'Complete age safety before using private messages.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.user_blocks block
    where (
      block.blocker_id = new.sender_id
      and block.blocked_id = recipient_id
    ) or (
      block.blocker_id = recipient_id
      and block.blocked_id = new.sender_id
    )
  ) then
    raise exception 'You cannot message this member.' using errcode = 'P0001';
  end if;

  if sender_band = 'adult' and recipient_band = 'teen' then
    if not exists (
      select 1
      from public.teen_contact_permissions permission
      where permission.teen_user_id = recipient_id
        and permission.adult_user_id = new.sender_id
        and permission.status = 'allowed'
    ) then
      raise exception 'The teen member must start this conversation before an adult can reply.'
        using errcode = 'P0001';
    end if;
  elsif sender_band = 'teen' and recipient_band = 'adult' then
    insert into public.teen_contact_permissions (
      teen_user_id,
      adult_user_id,
      status,
      source,
      source_id,
      granted_at,
      revoked_at,
      updated_at
    ) values (
      new.sender_id,
      recipient_id,
      'allowed',
      'teen_sent_message',
      new.conversation_id,
      now(),
      null,
      now()
    )
    on conflict (teen_user_id, adult_user_id) do update set
      status = 'allowed',
      source = 'teen_sent_message',
      source_id = excluded.source_id,
      granted_at = now(),
      revoked_at = null,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_teen_private_message_trigger
  on public.private_messages;
create trigger enforce_teen_private_message_trigger
before insert
on public.private_messages
for each row execute function public.enforce_teen_private_message();

insert into public.teen_contact_permissions (
  teen_user_id,
  adult_user_id,
  status,
  source,
  source_id,
  granted_at,
  updated_at
)
select distinct
  teen_member.user_id,
  adult_member.user_id,
  'allowed',
  'legacy_teen_initiated',
  conversation.id,
  coalesce(conversation.created_at, now()),
  now()
from public.private_conversations conversation
join public.private_conversation_members teen_member
  on teen_member.conversation_id = conversation.id
  and teen_member.deleted_at is null
join public.profile_sensitive teen_sensitive
  on teen_sensitive.id = teen_member.user_id
  and teen_sensitive.age_band = 'teen'
join public.private_conversation_members adult_member
  on adult_member.conversation_id = conversation.id
  and adult_member.deleted_at is null
  and adult_member.user_id <> teen_member.user_id
join public.profile_sensitive adult_sensitive
  on adult_sensitive.id = adult_member.user_id
  and adult_sensitive.age_band = 'adult'
where conversation.created_by = teen_member.user_id
  or exists (
    select 1
    from public.private_messages first_message
    where first_message.conversation_id = conversation.id
      and first_message.sender_id = teen_member.user_id
      and first_message.created_at = (
        select min(all_messages.created_at)
        from public.private_messages all_messages
        where all_messages.conversation_id = conversation.id
      )
  )
on conflict (teen_user_id, adult_user_id) do nothing;

insert into public.room_minor_safety_settings (
  room_id,
  allows_minors,
  requires_staff_approval,
  adult_contact_mode
)
select
  room.id,
  case
    when lower(coalesce(room.room_type, '')) = 'classroom' then true
    when exists (
      select 1
      from public.room_members member
      join public.profile_sensitive sensitive on sensitive.id = member.user_id
      where member.room_id = room.id
        and sensitive.age_band = 'teen'
        and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive')
    ) then true
    else false
  end,
  true,
  'teen_initiated'
from public.rooms room
on conflict (room_id) do nothing;

create or replace function public.enforce_room_minor_membership()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  member_band text := 'unknown';
  safety_row public.room_minor_safety_settings%rowtype;
  normalized_role text;
begin
  select coalesce(age_band, 'unknown')
  into member_band
  from public.profile_sensitive
  where id = new.user_id;

  if member_band = 'under_13' then
    raise exception 'This account is not eligible to use Loombus.'
      using errcode = 'P0001';
  end if;

  if member_band <> 'teen' then
    return new;
  end if;

  select *
  into safety_row
  from public.room_minor_safety_settings
  where room_id = new.room_id;

  if not found or safety_row.allows_minors is not true then
    raise exception 'This Room is not configured for teen members.'
      using errcode = 'P0001';
  end if;

  normalized_role := lower(coalesce(new.role, 'member'));
  if normalized_role in ('owner', 'admin', 'administrator', 'moderator') then
    raise exception 'Teen members cannot hold Room staff roles in this release.'
      using errcode = 'P0001';
  end if;

  new.role := 'member';
  return new;
end;
$$;

drop trigger if exists enforce_room_minor_membership_trigger
  on public.room_members;
create trigger enforce_room_minor_membership_trigger
before insert or update of user_id, role, status
on public.room_members
for each row execute function public.enforce_room_minor_membership();

create or replace function public.enforce_adult_managed_record()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  payload jsonb := to_jsonb(new);
  actor_id uuid;
  actor_band text := 'unknown';
begin
  actor_id := coalesce(
    nullif(payload ->> 'seller_id', '')::uuid,
    nullif(payload ->> 'created_by', '')::uuid,
    nullif(payload ->> 'organizer_id', '')::uuid,
    nullif(payload ->> 'requester_id', '')::uuid,
    nullif(payload ->> 'provider_id', '')::uuid,
    nullif(payload ->> 'owner_id', '')::uuid,
    nullif(payload ->> 'user_id', '')::uuid
  );

  if actor_id is null then
    return new;
  end if;

  select coalesce(age_band, 'unknown')
  into actor_band
  from public.profile_sensitive
  where id = actor_id;

  if actor_band = 'teen' then
    raise exception 'This public commercial or management feature is available only to adult accounts.'
      using errcode = 'P0001';
  end if;

  if actor_band = 'under_13' then
    raise exception 'This account is not eligible to use Loombus.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'marketplace_listings',
    'job_postings',
    'public_events',
    'service_requests',
    'provider_services',
    'businesses',
    'business_profiles',
    'appointment_services',
    'appointment_requests',
    'rooms'
  ] loop
    if to_regclass('public.' || target_table) is not null then
      execute format(
        'drop trigger if exists enforce_adult_managed_record_trigger on public.%I',
        target_table
      );
      execute format(
        'create trigger enforce_adult_managed_record_trigger before insert on public.%I for each row execute function public.enforce_adult_managed_record()',
        target_table
      );
    end if;
  end loop;
end;
$$;

-- Existing teen-owned or teen-managed public records remain intact and are queued for review.
do $$
declare
  target_table text;
  actor_column text;
  id_column text := 'id';
  sql_text text;
begin
  for target_table, actor_column in
    select * from (values
      ('marketplace_listings', 'seller_id'),
      ('job_postings', 'created_by'),
      ('public_events', 'organizer_id'),
      ('service_requests', 'requester_id'),
      ('provider_services', 'provider_id'),
      ('businesses', 'owner_id'),
      ('business_profiles', 'owner_id'),
      ('appointment_services', 'provider_id'),
      ('appointment_requests', 'requester_id'),
      ('rooms', 'owner_id')
    ) as configured(table_name, owner_column)
  loop
    if to_regclass('public.' || target_table) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = actor_column
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = target_table
          and column_name = id_column
      )
    then
      sql_text := format(
        'insert into public.teen_safety_review_items (user_id, source_type, source_id, reason_code) '
        || 'select source.%1$I, %2$L, source.id, %3$L '
        || 'from public.%2$I source '
        || 'join public.profile_sensitive sensitive on sensitive.id = source.%1$I '
        || 'where sensitive.age_band = ''teen'' '
        || 'on conflict do nothing',
        actor_column,
        target_table,
        'LEGACY_TEEN_MANAGED_RECORD'
      );
      execute sql_text;
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
