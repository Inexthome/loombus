-- Multi-Room Organization Console, shared branding, security, and Enterprise retention.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.room_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subscription_id text,
  plan_key text not null default 'organization',
  branding jsonb not null default jsonb_build_object(
    'logoUrl', '',
    'accent', '',
    'description', ''
  ),
  security jsonb not null default jsonb_build_object(
    'allowedEmailDomains', '[]'::jsonb,
    'requireInviteApproval', true,
    'defaultInviteRole', 'member',
    'legalHold', false,
    'retentionDays', 0
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_organizations_name_length_check
    check (char_length(name) between 1 and 160),
  constraint room_organizations_plan_check
    check (plan_key in ('organization', 'organization-plus', 'enterprise'))
);

create unique index if not exists room_organizations_subscription_unique_idx
  on public.room_organizations (subscription_id)
  where subscription_id is not null;

create index if not exists room_organizations_owner_idx
  on public.room_organizations (owner_id, created_at desc);

create table if not exists public.room_organization_members (
  organization_id uuid not null references public.room_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  constraint room_organization_members_role_check
    check (role in ('owner', 'administrator', 'member'))
);

create index if not exists room_organization_members_user_idx
  on public.room_organization_members (user_id, updated_at desc);

alter table public.rooms
  add column if not exists organization_id uuid
    references public.room_organizations(id) on delete set null;

create index if not exists rooms_organization_idx
  on public.rooms (organization_id, created_at desc)
  where organization_id is not null;

do $$
declare
  grouping record;
  organization_uuid uuid;
  organization_name text;
begin
  for grouping in
    select
      coalesce(room.owner_id, room.created_by) as owner_id,
      room.stripe_subscription_id,
      max(room.subscription_plan) as plan_key,
      min(room.name) as first_room_name
    from public.rooms room
    where room.subscription_plan in (
      'organization',
      'organization-plus',
      'enterprise'
    )
      and coalesce(room.owner_id, room.created_by) is not null
    group by
      coalesce(room.owner_id, room.created_by),
      room.stripe_subscription_id
  loop
    organization_name := left(
      coalesce(nullif(trim(grouping.first_room_name), ''), 'Loombus Organization'),
      140
    );

    if grouping.stripe_subscription_id is not null then
      insert into public.room_organizations (
        owner_id,
        name,
        subscription_id,
        plan_key
      )
      values (
        grouping.owner_id,
        organization_name,
        grouping.stripe_subscription_id,
        case
          when grouping.plan_key in ('organization', 'organization-plus', 'enterprise')
            then grouping.plan_key
          else 'organization'
        end
      )
      on conflict (subscription_id) where subscription_id is not null
      do update set
        owner_id = excluded.owner_id,
        plan_key = excluded.plan_key,
        updated_at = now()
      returning id into organization_uuid;
    else
      select organization.id
      into organization_uuid
      from public.room_organizations organization
      where organization.owner_id = grouping.owner_id
        and organization.subscription_id is null
      order by organization.created_at asc
      limit 1;

      if organization_uuid is null then
        insert into public.room_organizations (
          owner_id,
          name,
          plan_key
        )
        values (
          grouping.owner_id,
          organization_name,
          case
            when grouping.plan_key in ('organization', 'organization-plus', 'enterprise')
              then grouping.plan_key
            else 'organization'
          end
        )
        returning id into organization_uuid;
      end if;
    end if;

    update public.rooms room
    set organization_id = organization_uuid
    where coalesce(room.owner_id, room.created_by) = grouping.owner_id
      and room.subscription_plan in (
        'organization',
        'organization-plus',
        'enterprise'
      )
      and room.stripe_subscription_id is not distinct from grouping.stripe_subscription_id
      and room.organization_id is null;

    insert into public.room_organization_members (
      organization_id,
      user_id,
      role
    )
    values (
      organization_uuid,
      grouping.owner_id,
      'owner'
    )
    on conflict (organization_id, user_id)
    do update set
      role = 'owner',
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.touch_room_expansion_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_room_organizations_updated_at
  on public.room_organizations;
create trigger touch_room_organizations_updated_at
before update on public.room_organizations
for each row execute function public.touch_room_expansion_updated_at();

drop trigger if exists touch_room_organization_members_updated_at
  on public.room_organization_members;
create trigger touch_room_organization_members_updated_at
before update on public.room_organization_members
for each row execute function public.touch_room_expansion_updated_at();

alter table public.room_organizations enable row level security;
alter table public.room_organization_members enable row level security;

revoke all on table public.room_organizations from anon, authenticated;
revoke all on table public.room_organization_members from anon, authenticated;

notify pgrst, 'reload schema';

commit;
