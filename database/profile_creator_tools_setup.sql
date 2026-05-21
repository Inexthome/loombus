-- Profile Creator/Supporter Tools setup for Loombus
-- Purpose:
-- - Add optional creator/support links to public profiles.
-- - Keep the fields blank by default.
-- - Allow all users to clear creator/support fields.
-- - Allow only Premium Plus/Admin users to save non-empty creator/support fields.

alter table if exists public.profiles
  add column if not exists creator_website_url text;

alter table if exists public.profiles
  add column if not exists creator_support_url text;

alter table if exists public.profiles
  add column if not exists creator_support_label text;

alter table if exists public.profiles
  drop constraint if exists profiles_creator_website_url_length;

alter table if exists public.profiles
  add constraint profiles_creator_website_url_length
  check (
    creator_website_url is null
    or char_length(trim(creator_website_url)) <= 240
  );

alter table if exists public.profiles
  drop constraint if exists profiles_creator_support_url_length;

alter table if exists public.profiles
  add constraint profiles_creator_support_url_length
  check (
    creator_support_url is null
    or char_length(trim(creator_support_url)) <= 240
  );

alter table if exists public.profiles
  drop constraint if exists profiles_creator_support_label_length;

alter table if exists public.profiles
  add constraint profiles_creator_support_label_length
  check (
    creator_support_label is null
    or char_length(trim(creator_support_label)) <= 40
  );

alter table if exists public.profiles
  drop constraint if exists profiles_creator_website_url_format;

alter table if exists public.profiles
  add constraint profiles_creator_website_url_format
  check (
    creator_website_url is null
    or trim(creator_website_url) = ''
    or trim(creator_website_url) ~* '^https?://'
  );

alter table if exists public.profiles
  drop constraint if exists profiles_creator_support_url_format;

alter table if exists public.profiles
  add constraint profiles_creator_support_url_format
  check (
    creator_support_url is null
    or trim(creator_support_url) = ''
    or trim(creator_support_url) ~* '^https?://'
  );

create or replace function public.user_has_creator_profile_tools_access(target_user_id uuid)
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

create or replace function public.ensure_creator_profile_tools_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_creator_fields boolean;
begin
  new.creator_website_url = nullif(trim(coalesce(new.creator_website_url, '')), '');
  new.creator_support_url = nullif(trim(coalesce(new.creator_support_url, '')), '');
  new.creator_support_label = nullif(trim(coalesce(new.creator_support_label, '')), '');

  has_creator_fields :=
    new.creator_website_url is not null
    or new.creator_support_url is not null
    or new.creator_support_label is not null;

  if not has_creator_fields then
    return new;
  end if;

  if not public.user_has_creator_profile_tools_access(new.id) then
    raise exception 'Creator/supporter profile tools require Premium Plus or Admin access.';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_creator_profile_tools_access
  on public.profiles;

create trigger ensure_creator_profile_tools_access
before insert or update of creator_website_url, creator_support_url, creator_support_label
on public.profiles
for each row
execute function public.ensure_creator_profile_tools_access();

comment on column public.profiles.creator_website_url is
'Optional public creator website/profile link for Premium Plus/Admin users.';

comment on column public.profiles.creator_support_url is
'Optional public support link for Premium Plus/Admin users.';

comment on column public.profiles.creator_support_label is
'Optional display label for the support link.';
