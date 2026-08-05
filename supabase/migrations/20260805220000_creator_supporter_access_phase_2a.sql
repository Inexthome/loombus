-- Creator Supporters Phase 2A.
-- Adds free creator supporter programs, free benefit tiers, supporter-only Discussion
-- visibility, and optional private Room access. This migration intentionally adds no
-- pricing, checkout, earnings, payout, tax, or creator-balance fields.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.creator_supporter_programs (
  creator_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  headline text not null default 'Support my work',
  welcome_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_supporter_programs_headline_length_check
    check (char_length(headline) between 2 and 80),
  constraint creator_supporter_programs_welcome_length_check
    check (char_length(welcome_message) <= 500)
);

create table if not exists public.creator_supporter_tiers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  benefits text[] not null default '{}'::text[],
  room_id uuid references public.rooms(id) on delete set null,
  position smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_supporter_tiers_name_length_check
    check (char_length(name) between 2 and 40),
  constraint creator_supporter_tiers_description_length_check
    check (char_length(description) <= 300),
  constraint creator_supporter_tiers_benefit_count_check
    check (cardinality(benefits) <= 8),
  constraint creator_supporter_tiers_position_check
    check (position between 0 and 20)
);

create index if not exists creator_supporter_tiers_creator_active_idx
  on public.creator_supporter_tiers (creator_id, is_active, position, created_at);
create unique index if not exists creator_supporter_tiers_creator_name_unique_idx
  on public.creator_supporter_tiers (creator_id, lower(name))
  where is_active = true;

create table if not exists public.creator_supporter_memberships (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  supporter_id uuid not null references auth.users(id) on delete cascade,
  tier_id uuid references public.creator_supporter_tiers(id) on delete set null,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_supporter_memberships_distinct_users_check
    check (creator_id <> supporter_id),
  constraint creator_supporter_memberships_status_check
    check (status in ('active', 'left', 'removed')),
  unique (creator_id, supporter_id)
);

create index if not exists creator_supporter_memberships_creator_status_idx
  on public.creator_supporter_memberships (creator_id, status, joined_at desc);
create index if not exists creator_supporter_memberships_supporter_status_idx
  on public.creator_supporter_memberships (supporter_id, status, joined_at desc);
create index if not exists creator_supporter_memberships_tier_status_idx
  on public.creator_supporter_memberships (tier_id, status);

create table if not exists public.creator_supporter_room_grants (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  supporter_id uuid not null references auth.users(id) on delete cascade,
  tier_id uuid references public.creator_supporter_tiers(id) on delete set null,
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_member_id uuid references public.room_members(id) on delete set null,
  provisioned_membership boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (creator_id, supporter_id, room_id)
);

create index if not exists creator_supporter_room_grants_member_idx
  on public.creator_supporter_room_grants (supporter_id, active, room_id);

alter table public.creator_supporter_programs enable row level security;
alter table public.creator_supporter_tiers enable row level security;
alter table public.creator_supporter_memberships enable row level security;
alter table public.creator_supporter_room_grants enable row level security;

revoke all on table public.creator_supporter_programs from public, anon, authenticated;
revoke all on table public.creator_supporter_tiers from public, anon, authenticated;
revoke all on table public.creator_supporter_memberships from public, anon, authenticated;
revoke all on table public.creator_supporter_room_grants from public, anon, authenticated;

grant all on table public.creator_supporter_programs to service_role;
grant all on table public.creator_supporter_tiers to service_role;
grant all on table public.creator_supporter_memberships to service_role;
grant all on table public.creator_supporter_room_grants to service_role;

create or replace function public.touch_creator_supporter_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_creator_supporter_programs_updated_at
  on public.creator_supporter_programs;
create trigger touch_creator_supporter_programs_updated_at
before update on public.creator_supporter_programs
for each row execute function public.touch_creator_supporter_updated_at();

drop trigger if exists touch_creator_supporter_tiers_updated_at
  on public.creator_supporter_tiers;
create trigger touch_creator_supporter_tiers_updated_at
before update on public.creator_supporter_tiers
for each row execute function public.touch_creator_supporter_updated_at();

drop trigger if exists touch_creator_supporter_memberships_updated_at
  on public.creator_supporter_memberships;
create trigger touch_creator_supporter_memberships_updated_at
before update on public.creator_supporter_memberships
for each row execute function public.touch_creator_supporter_updated_at();

create or replace function public.creator_has_supporter_program_access(p_creator_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce((
    select profile.is_admin = true
      or (
        entitlement.ai_assisted_enabled = true
        and entitlement.tier = 'premium'
        and coalesce(entitlement.monthly_summary_limit, 0) > 50
      )
    from public.profiles profile
    left join public.user_ai_entitlements entitlement
      on entitlement.user_id = profile.id
    where profile.id = p_creator_id
      and coalesce(profile.account_status, 'active') in ('active', 'warned')
    limit 1
  ), false);
$$;

create or replace function public.creator_supporter_membership_is_active(
  p_creator_id uuid,
  p_supporter_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.creator_supporter_memberships membership
    join public.creator_supporter_programs program
      on program.creator_id = membership.creator_id
     and program.enabled = true
    where membership.creator_id = p_creator_id
      and membership.supporter_id = p_supporter_id
      and membership.status = 'active'
  );
$$;

create or replace function public.save_creator_supporter_program(
  p_creator_id uuid,
  p_enabled boolean,
  p_headline text,
  p_welcome_message text,
  p_tiers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  clean_headline text := trim(coalesce(p_headline, 'Support my work'));
  clean_welcome text := trim(coalesce(p_welcome_message, ''));
  tier_count integer := coalesce(jsonb_array_length(coalesce(p_tiers, '[]'::jsonb)), 0);
  tier_item jsonb;
  tier_id uuid;
  clean_name text;
  clean_description text;
  clean_benefits text[];
  linked_room_id uuid;
  position_value integer := 0;
  retained_ids uuid[] := '{}'::uuid[];
begin
  if not public.creator_has_supporter_program_access(p_creator_id) then
    raise exception 'Creator supporter programs require Premium Plus access.'
      using errcode = '42501';
  end if;

  if char_length(clean_headline) not between 2 and 80 then
    raise exception 'Supporter program headline must be 2 to 80 characters.'
      using errcode = '22001';
  end if;

  if char_length(clean_welcome) > 500 then
    raise exception 'Supporter welcome message must be 500 characters or fewer.'
      using errcode = '22001';
  end if;

  if tier_count < 1 or tier_count > 4 then
    raise exception 'Create between one and four free supporter tiers.'
      using errcode = '23514';
  end if;

  insert into public.creator_supporter_programs (
    creator_id,
    enabled,
    headline,
    welcome_message
  ) values (
    p_creator_id,
    coalesce(p_enabled, false),
    clean_headline,
    clean_welcome
  )
  on conflict (creator_id) do update
  set enabled = excluded.enabled,
      headline = excluded.headline,
      welcome_message = excluded.welcome_message,
      updated_at = now();

  for tier_item in select value from jsonb_array_elements(p_tiers)
  loop
    if tier_item ? 'price'
      or tier_item ? 'price_cents'
      or tier_item ? 'currency'
      or tier_item ? 'billing_interval'
    then
      raise exception 'Phase 2A supporter tiers must remain free.'
        using errcode = '23514';
    end if;

    tier_id := case
      when coalesce(tier_item ->> 'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (tier_item ->> 'id')::uuid
      else gen_random_uuid()
    end;
    clean_name := trim(coalesce(tier_item ->> 'name', ''));
    clean_description := trim(coalesce(tier_item ->> 'description', ''));
    linked_room_id := case
      when coalesce(tier_item ->> 'roomId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (tier_item ->> 'roomId')::uuid
      else null
    end;

    select coalesce(array_agg(trim(benefit)) filter (where trim(benefit) <> ''), '{}'::text[])
    into clean_benefits
    from jsonb_array_elements_text(coalesce(tier_item -> 'benefits', '[]'::jsonb)) as benefit;

    if char_length(clean_name) not between 2 and 40 then
      raise exception 'Each supporter tier needs a 2 to 40 character name.'
        using errcode = '22001';
    end if;
    if char_length(clean_description) > 300 then
      raise exception 'Tier descriptions must be 300 characters or fewer.'
        using errcode = '22001';
    end if;
    if cardinality(clean_benefits) > 8
      or exists (select 1 from unnest(clean_benefits) benefit where char_length(benefit) > 120)
    then
      raise exception 'Use no more than eight benefits, each 120 characters or fewer.'
        using errcode = '23514';
    end if;

    if linked_room_id is not null and not exists (
      select 1
      from public.rooms room
      where room.id = linked_room_id
        and (room.owner_id = p_creator_id or room.created_by = p_creator_id)
        and coalesce(room.status, 'active') = 'active'
    ) then
      raise exception 'A linked supporter Room must be an active Room you own.'
        using errcode = '42501';
    end if;

    if exists (
      select 1
      from public.creator_supporter_tiers existing
      where existing.id = tier_id
        and existing.creator_id <> p_creator_id
    ) then
      raise exception 'Supporter tier ownership could not be verified.'
        using errcode = '42501';
    end if;

    insert into public.creator_supporter_tiers (
      id,
      creator_id,
      name,
      description,
      benefits,
      room_id,
      position,
      is_active
    ) values (
      tier_id,
      p_creator_id,
      clean_name,
      clean_description,
      clean_benefits,
      linked_room_id,
      position_value,
      true
    )
    on conflict (id) do update
    set name = excluded.name,
        description = excluded.description,
        benefits = excluded.benefits,
        room_id = excluded.room_id,
        position = excluded.position,
        is_active = true,
        updated_at = now()
    where public.creator_supporter_tiers.creator_id = p_creator_id;

    retained_ids := array_append(retained_ids, tier_id);
    position_value := position_value + 1;
  end loop;

  if exists (
    select 1
    from public.creator_supporter_tiers tier
    where tier.creator_id = p_creator_id
      and tier.is_active = true
      and not (tier.id = any(retained_ids))
      and exists (
        select 1
        from public.creator_supporter_memberships membership
        where membership.tier_id = tier.id
          and membership.status = 'active'
      )
  ) then
    raise exception 'Move active supporters before removing a tier.'
      using errcode = '23514';
  end if;

  update public.creator_supporter_tiers
  set is_active = false,
      updated_at = now()
  where creator_id = p_creator_id
    and is_active = true
    and not (id = any(retained_ids));

  return jsonb_build_object(
    'program', (
      select to_jsonb(program)
      from public.creator_supporter_programs program
      where program.creator_id = p_creator_id
    ),
    'tiers', (
      select coalesce(jsonb_agg(to_jsonb(tier) order by tier.position), '[]'::jsonb)
      from public.creator_supporter_tiers tier
      where tier.creator_id = p_creator_id
        and tier.is_active = true
    )
  );
end;
$$;

create or replace function public.join_creator_supporter_program(
  p_creator_id uuid,
  p_supporter_id uuid,
  p_tier_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  tier_row public.creator_supporter_tiers%rowtype;
  membership_row public.creator_supporter_memberships%rowtype;
  existing_member public.room_members%rowtype;
  grant_row public.creator_supporter_room_grants%rowtype;
  room_member_id uuid;
  provisioned boolean := false;
begin
  if p_creator_id = p_supporter_id then
    raise exception 'You cannot join your own supporter program.' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_supporter_id
      and coalesce(profile.account_status, 'active') in ('active', 'warned')
  ) then
    raise exception 'This account cannot join a supporter program.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.creator_supporter_programs program
    where program.creator_id = p_creator_id
      and program.enabled = true
  ) then
    raise exception 'This supporter program is not active.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = p_creator_id and block.blocked_id = p_supporter_id)
       or (block.blocker_id = p_supporter_id and block.blocked_id = p_creator_id)
  ) then
    raise exception 'This supporter relationship is unavailable.' using errcode = '42501';
  end if;

  select * into tier_row
  from public.creator_supporter_tiers tier
  where tier.id = p_tier_id
    and tier.creator_id = p_creator_id
    and tier.is_active = true;

  if tier_row.id is null then
    raise exception 'Choose an active supporter tier.' using errcode = '23514';
  end if;

  select * into membership_row
  from public.creator_supporter_memberships membership
  where membership.creator_id = p_creator_id
    and membership.supporter_id = p_supporter_id;

  for grant_row in
    select *
    from public.creator_supporter_room_grants grant_record
    where grant_record.creator_id = p_creator_id
      and grant_record.supporter_id = p_supporter_id
      and grant_record.active = true
      and (tier_row.room_id is null or grant_record.room_id <> tier_row.room_id)
  loop
    if grant_row.provisioned_membership and grant_row.room_member_id is not null then
      update public.room_members
      set status = 'removed',
          updated_at = now()
      where id = grant_row.room_member_id
        and user_id = p_supporter_id
        and role = 'member'
        and coalesce(status, 'active') not in ('blocked', 'removed', 'inactive');
    end if;

    update public.creator_supporter_room_grants
    set active = false,
        ended_at = now()
    where id = grant_row.id;
  end loop;

  insert into public.creator_supporter_memberships (
    creator_id,
    supporter_id,
    tier_id,
    status,
    joined_at,
    ended_at
  ) values (
    p_creator_id,
    p_supporter_id,
    tier_row.id,
    'active',
    now(),
    null
  )
  on conflict (creator_id, supporter_id) do update
  set tier_id = excluded.tier_id,
      status = 'active',
      ended_at = null,
      joined_at = case
        when public.creator_supporter_memberships.status = 'active'
          then public.creator_supporter_memberships.joined_at
        else now()
      end,
      updated_at = now()
  returning * into membership_row;

  if tier_row.room_id is not null then
    if not exists (
      select 1
      from public.rooms room
      where room.id = tier_row.room_id
        and (room.owner_id = p_creator_id or room.created_by = p_creator_id)
        and coalesce(room.status, 'active') = 'active'
    ) then
      raise exception 'The linked supporter Room is unavailable.' using errcode = '23514';
    end if;

    select * into existing_member
    from public.room_members member
    where member.room_id = tier_row.room_id
      and member.user_id = p_supporter_id;

    if existing_member.id is null then
      insert into public.room_members (room_id, user_id, role, status, joined_at)
      values (tier_row.room_id, p_supporter_id, 'member', 'active', now())
      returning id into room_member_id;
      provisioned := true;
    elsif coalesce(existing_member.status, 'active') = 'blocked' then
      raise exception 'Room access is blocked for this account.' using errcode = '42501';
    elsif coalesce(existing_member.status, 'active') in ('removed', 'inactive') then
      if exists (
        select 1
        from public.creator_supporter_room_grants previous_grant
        where previous_grant.creator_id = p_creator_id
          and previous_grant.supporter_id = p_supporter_id
          and previous_grant.room_id = tier_row.room_id
          and previous_grant.provisioned_membership = true
      ) then
        update public.room_members
        set status = 'active',
            role = 'member',
            joined_at = now(),
            updated_at = now()
        where id = existing_member.id
        returning id into room_member_id;
        provisioned := true;
      else
        raise exception 'Room access requires approval from the Room owner.' using errcode = '42501';
      end if;
    else
      room_member_id := existing_member.id;
      provisioned := false;
    end if;

    insert into public.creator_supporter_room_grants (
      creator_id,
      supporter_id,
      tier_id,
      room_id,
      room_member_id,
      provisioned_membership,
      active,
      ended_at
    ) values (
      p_creator_id,
      p_supporter_id,
      tier_row.id,
      tier_row.room_id,
      room_member_id,
      provisioned,
      true,
      null
    )
    on conflict (creator_id, supporter_id, room_id) do update
    set tier_id = excluded.tier_id,
        room_member_id = excluded.room_member_id,
        provisioned_membership = excluded.provisioned_membership,
        active = true,
        ended_at = null;
  end if;

  return jsonb_build_object(
    'membershipId', membership_row.id,
    'tierId', membership_row.tier_id,
    'status', membership_row.status,
    'roomId', tier_row.room_id
  );
end;
$$;

create or replace function public.end_creator_supporter_membership(
  p_creator_id uuid,
  p_supporter_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  ending_status text;
  grant_row public.creator_supporter_room_grants%rowtype;
begin
  if p_actor_id = p_supporter_id then
    ending_status := 'left';
  elsif p_actor_id = p_creator_id or exists (
    select 1 from public.profiles profile
    where profile.id = p_actor_id and profile.is_admin = true
  ) then
    ending_status := 'removed';
  else
    raise exception 'You cannot end this supporter membership.' using errcode = '42501';
  end if;

  update public.creator_supporter_memberships
  set status = ending_status,
      ended_at = now(),
      updated_at = now()
  where creator_id = p_creator_id
    and supporter_id = p_supporter_id
    and status = 'active';

  for grant_row in
    select *
    from public.creator_supporter_room_grants grant_record
    where grant_record.creator_id = p_creator_id
      and grant_record.supporter_id = p_supporter_id
      and grant_record.active = true
  loop
    if grant_row.provisioned_membership and grant_row.room_member_id is not null then
      update public.room_members
      set status = 'removed',
          updated_at = now()
      where id = grant_row.room_member_id
        and user_id = p_supporter_id
        and role = 'member'
        and coalesce(status, 'active') not in ('blocked', 'removed', 'inactive');
    end if;

    update public.creator_supporter_room_grants
    set active = false,
        ended_at = now()
    where id = grant_row.id;
  end loop;

  return jsonb_build_object('status', ending_status);
end;
$$;

-- Add Supporters as a database-enforced Discussion audience.
alter table public.discussions
  drop constraint if exists discussions_audience_type_check;
alter table public.discussions
  add constraint discussions_audience_type_check
  check (
    audience_type in (
      'public', 'followers', 'supporters', 'connections',
      'exclude_selected', 'selected', 'only_me', 'custom'
    )
  );

alter table public.discussion_audience_preferences
  drop constraint if exists discussion_audience_preferences_type_check;
alter table public.discussion_audience_preferences
  add constraint discussion_audience_preferences_type_check
  check (
    default_audience_type in (
      'public', 'followers', 'supporters', 'connections',
      'exclude_selected', 'selected', 'only_me', 'custom'
    )
  );

create or replace function public.normalize_discussion_audience_preference()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  normalized_include_ids uuid[] := '{}'::uuid[];
  normalized_exclude_ids uuid[] := '{}'::uuid[];
begin
  if new.default_audience_type = 'supporters'
    and not exists (
      select 1
      from public.creator_supporter_programs program
      where program.creator_id = new.user_id
        and program.enabled = true
    )
  then
    raise exception 'Enable your Creator Supporter program before choosing Supporters.'
      using errcode = '23514';
  end if;

  select coalesce(array_agg(distinct selected.candidate_id), '{}'::uuid[])
  into normalized_include_ids
  from unnest(coalesce(new.include_user_ids, '{}'::uuid[])) as selected(candidate_id)
  where selected.candidate_id <> new.user_id
    and exists (
      select 1 from public.profiles profile
      where profile.id = selected.candidate_id
        and coalesce(profile.account_status, 'active') not in (
          'blocked', 'deleted', 'deactivated', 'suspended',
          'banned', 'pending_deletion'
        )
    )
    and exists (
      select 1 from public.follows relationship
      where (relationship.follower_id = new.user_id and relationship.following_id = selected.candidate_id)
         or (relationship.follower_id = selected.candidate_id and relationship.following_id = new.user_id)
    )
    and not exists (
      select 1 from public.user_blocks block
      where (block.blocker_id = new.user_id and block.blocked_id = selected.candidate_id)
         or (block.blocker_id = selected.candidate_id and block.blocked_id = new.user_id)
    );

  select coalesce(array_agg(distinct selected.candidate_id), '{}'::uuid[])
  into normalized_exclude_ids
  from unnest(coalesce(new.exclude_user_ids, '{}'::uuid[])) as selected(candidate_id)
  where selected.candidate_id <> new.user_id
    and exists (
      select 1 from public.profiles profile
      where profile.id = selected.candidate_id
        and coalesce(profile.account_status, 'active') not in (
          'blocked', 'deleted', 'deactivated', 'suspended',
          'banned', 'pending_deletion'
        )
    )
    and exists (
      select 1 from public.follows relationship
      where (relationship.follower_id = new.user_id and relationship.following_id = selected.candidate_id)
         or (relationship.follower_id = selected.candidate_id and relationship.following_id = new.user_id)
    );

  normalized_include_ids := array(
    select selected.candidate_id
    from unnest(normalized_include_ids) as selected(candidate_id)
    where not (selected.candidate_id = any(normalized_exclude_ids))
  );

  if new.default_audience_type not in ('selected', 'custom') then
    normalized_include_ids := '{}'::uuid[];
  end if;
  if new.default_audience_type not in ('exclude_selected', 'custom') then
    normalized_exclude_ids := '{}'::uuid[];
  end if;
  if new.default_audience_type = 'selected' and cardinality(normalized_include_ids) = 0 then
    raise exception 'Choose at least one person for Only show to.' using errcode = '23514';
  end if;
  if new.default_audience_type = 'exclude_selected' and cardinality(normalized_exclude_ids) = 0 then
    raise exception 'Choose at least one person for Don''t show to.' using errcode = '23514';
  end if;

  new.include_user_ids := normalized_include_ids;
  new.exclude_user_ids := normalized_exclude_ids;
  new.default_audience_base := case
    when new.default_audience_type = 'custom' then coalesce(new.default_audience_base, 'public')
    else null
  end;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.can_view_discussion_audience_row(
  p_discussion_id uuid,
  p_author_id uuid,
  p_audience_type text,
  p_audience_base text,
  p_viewer_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  normalized_type text := coalesce(nullif(p_audience_type, ''), 'public');
  normalized_base text := coalesce(nullif(p_audience_base, ''), 'public');
  base_allowed boolean := false;
  explicitly_included boolean := false;
  explicitly_excluded boolean := false;
begin
  if normalized_type = 'public' then return true; end if;
  if normalized_type in ('exclude_selected', 'custom')
    and normalized_base = 'public' and p_viewer_user_id is null then return true; end if;
  if p_viewer_user_id is null then return false; end if;
  if p_viewer_user_id = p_author_id or public.is_discussion_audience_admin(p_viewer_user_id) then return true; end if;

  if exists (
    select 1 from public.user_blocks block
    where (block.blocker_id = p_author_id and block.blocked_id = p_viewer_user_id)
       or (block.blocker_id = p_viewer_user_id and block.blocked_id = p_author_id)
  ) then return false; end if;

  select exists (
    select 1 from public.discussion_audience_members member
    where member.discussion_id = p_discussion_id
      and member.user_id = p_viewer_user_id
      and member.access_kind = 'include'
  ) into explicitly_included;
  select exists (
    select 1 from public.discussion_audience_members member
    where member.discussion_id = p_discussion_id
      and member.user_id = p_viewer_user_id
      and member.access_kind = 'exclude'
  ) into explicitly_excluded;

  if normalized_type = 'only_me' then return false; end if;
  if normalized_type = 'exclude_selected' then return not explicitly_excluded; end if;
  if normalized_type = 'selected' then return explicitly_included and not explicitly_excluded; end if;
  if normalized_type = 'followers' then
    return exists (
      select 1 from public.follows relationship
      where relationship.follower_id = p_viewer_user_id
        and relationship.following_id = p_author_id
    );
  end if;
  if normalized_type = 'supporters' then
    return public.creator_supporter_membership_is_active(p_author_id, p_viewer_user_id);
  end if;
  if normalized_type = 'connections' then
    return exists (
      select 1 from public.follows incoming
      where incoming.follower_id = p_viewer_user_id and incoming.following_id = p_author_id
    ) and exists (
      select 1 from public.follows outgoing
      where outgoing.follower_id = p_author_id and outgoing.following_id = p_viewer_user_id
    );
  end if;
  if normalized_type = 'custom' then
    if normalized_base = 'public' then base_allowed := true;
    elsif normalized_base = 'followers' then
      base_allowed := exists (
        select 1 from public.follows relationship
        where relationship.follower_id = p_viewer_user_id
          and relationship.following_id = p_author_id
      );
    elsif normalized_base = 'connections' then
      base_allowed := exists (
        select 1 from public.follows incoming
        where incoming.follower_id = p_viewer_user_id and incoming.following_id = p_author_id
      ) and exists (
        select 1 from public.follows outgoing
        where outgoing.follower_id = p_author_id and outgoing.following_id = p_viewer_user_id
      );
    end if;
    return (base_allowed or explicitly_included) and not explicitly_excluded;
  end if;
  return false;
end;
$$;

create or replace function public.apply_discussion_audience_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  metadata jsonb := coalesce(new.discussion_metadata, '{}'::jsonb);
  preference_row record;
  requested_type text := 'public';
  requested_base text := 'public';
  include_ids uuid[] := '{}'::uuid[];
  exclude_ids uuid[] := '{}'::uuid[];
begin
  select preference.default_audience_type,
         preference.default_audience_base,
         preference.include_user_ids,
         preference.exclude_user_ids
  into preference_row
  from public.discussion_audience_preferences preference
  where preference.user_id = new.user_id;

  if found then
    requested_type := coalesce(nullif(preference_row.default_audience_type, ''), 'public');
    requested_base := coalesce(nullif(preference_row.default_audience_base, ''), 'public');
    include_ids := coalesce(preference_row.include_user_ids, '{}'::uuid[]);
    exclude_ids := coalesce(preference_row.exclude_user_ids, '{}'::uuid[]);
  end if;

  if requested_type not in (
    'public', 'followers', 'supporters', 'connections',
    'exclude_selected', 'selected', 'only_me', 'custom'
  ) then requested_type := 'public'; end if;
  if requested_type = 'custom' and requested_base not in ('public', 'followers', 'connections') then
    requested_base := 'public';
  end if;

  new.audience_type := requested_type;
  new.audience_base := case when requested_type = 'custom' then requested_base else null end;

  if requested_type in ('selected', 'custom') and cardinality(include_ids) > 0 then
    insert into public.discussion_audience_members (discussion_id, user_id, access_kind)
    select new.id, selected.candidate_id, 'include'
    from unnest(include_ids) as selected(candidate_id)
    where selected.candidate_id <> new.user_id
    on conflict do nothing;
  end if;
  if requested_type in ('exclude_selected', 'custom') and cardinality(exclude_ids) > 0 then
    insert into public.discussion_audience_members (discussion_id, user_id, access_kind)
    select new.id, selected.candidate_id, 'exclude'
    from unnest(exclude_ids) as selected(candidate_id)
    where selected.candidate_id <> new.user_id
    on conflict do nothing;
  end if;

  new.discussion_metadata := metadata
    - '__audience_type'
    - '__audience_base'
    - '__audience_include_ids'
    - '__audience_exclude_ids';
  return new;
end;
$$;

revoke all on function public.touch_creator_supporter_updated_at() from public, anon, authenticated;
revoke all on function public.creator_has_supporter_program_access(uuid) from public, anon, authenticated;
revoke all on function public.creator_supporter_membership_is_active(uuid, uuid) from public, anon, authenticated;
revoke all on function public.save_creator_supporter_program(uuid, boolean, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.join_creator_supporter_program(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.end_creator_supporter_membership(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.save_creator_supporter_program(uuid, boolean, text, text, jsonb) to service_role;
grant execute on function public.join_creator_supporter_program(uuid, uuid, uuid) to service_role;
grant execute on function public.end_creator_supporter_membership(uuid, uuid, uuid) to service_role;

notify pgrst, 'reload schema';

commit;
