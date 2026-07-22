-- Move Future Discussion visibility to the member's account Settings.
-- The saved preference is copied when a new Discussion is created.
-- Existing Discussions remain unchanged when the account preference changes later.

begin;

alter table public.discussions
  drop constraint if exists discussions_audience_type_check;

alter table public.discussions
  add constraint discussions_audience_type_check
  check (
    audience_type in (
      'public',
      'followers',
      'connections',
      'exclude_selected',
      'selected',
      'only_me',
      'custom'
    )
  );

alter table public.discussion_audience_preferences
  drop constraint if exists discussion_audience_preferences_type_check;

alter table public.discussion_audience_preferences
  add constraint discussion_audience_preferences_type_check
  check (
    default_audience_type in (
      'public',
      'followers',
      'connections',
      'exclude_selected',
      'selected',
      'only_me',
      'custom'
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
  select coalesce(array_agg(distinct selected.candidate_id), '{}'::uuid[])
  into normalized_include_ids
  from unnest(coalesce(new.include_user_ids, '{}'::uuid[]))
    as selected(candidate_id)
  where selected.candidate_id <> new.user_id
    and exists (
      select 1
      from public.profiles profile
      where profile.id = selected.candidate_id
        and coalesce(profile.account_status, 'active') not in (
          'blocked',
          'deleted',
          'deactivated',
          'suspended',
          'banned',
          'pending_deletion'
        )
    )
    and exists (
      select 1
      from public.follows relationship
      where (
        relationship.follower_id = new.user_id
        and relationship.following_id = selected.candidate_id
      ) or (
        relationship.follower_id = selected.candidate_id
        and relationship.following_id = new.user_id
      )
    )
    and not exists (
      select 1
      from public.user_blocks block
      where (
        block.blocker_id = new.user_id
        and block.blocked_id = selected.candidate_id
      ) or (
        block.blocker_id = selected.candidate_id
        and block.blocked_id = new.user_id
      )
    );

  select coalesce(array_agg(distinct selected.candidate_id), '{}'::uuid[])
  into normalized_exclude_ids
  from unnest(coalesce(new.exclude_user_ids, '{}'::uuid[]))
    as selected(candidate_id)
  where selected.candidate_id <> new.user_id
    and exists (
      select 1
      from public.profiles profile
      where profile.id = selected.candidate_id
        and coalesce(profile.account_status, 'active') not in (
          'blocked',
          'deleted',
          'deactivated',
          'suspended',
          'banned',
          'pending_deletion'
        )
    )
    and exists (
      select 1
      from public.follows relationship
      where (
        relationship.follower_id = new.user_id
        and relationship.following_id = selected.candidate_id
      ) or (
        relationship.follower_id = selected.candidate_id
        and relationship.following_id = new.user_id
      )
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

  if new.default_audience_type = 'selected'
    and cardinality(normalized_include_ids) = 0
  then
    raise exception 'Choose at least one person for Only show to.'
      using errcode = '23514';
  end if;

  if new.default_audience_type = 'exclude_selected'
    and cardinality(normalized_exclude_ids) = 0
  then
    raise exception 'Choose at least one person for Don''t show to.'
      using errcode = '23514';
  end if;

  new.include_user_ids := normalized_include_ids;
  new.exclude_user_ids := normalized_exclude_ids;
  new.default_audience_base := case
    when new.default_audience_type = 'custom'
      then coalesce(new.default_audience_base, 'public')
    else null
  end;
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists normalize_discussion_audience_preference_trigger
  on public.discussion_audience_preferences;
create trigger normalize_discussion_audience_preference_trigger
before insert or update on public.discussion_audience_preferences
for each row execute function public.normalize_discussion_audience_preference();

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
as $$
declare
  normalized_type text := coalesce(nullif(p_audience_type, ''), 'public');
  normalized_base text := coalesce(nullif(p_audience_base, ''), 'public');
  base_allowed boolean := false;
  explicitly_included boolean := false;
  explicitly_excluded boolean := false;
begin
  if normalized_type = 'public' then
    return true;
  end if;

  if normalized_type in ('exclude_selected', 'custom')
    and normalized_base = 'public'
    and p_viewer_user_id is null
  then
    return true;
  end if;

  if p_viewer_user_id is null then
    return false;
  end if;

  if p_viewer_user_id = p_author_id
    or public.is_discussion_audience_admin(p_viewer_user_id)
  then
    return true;
  end if;

  if exists (
    select 1
    from public.user_blocks block
    where (
      block.blocker_id = p_author_id
      and block.blocked_id = p_viewer_user_id
    ) or (
      block.blocker_id = p_viewer_user_id
      and block.blocked_id = p_author_id
    )
  ) then
    return false;
  end if;

  select exists (
    select 1
    from public.discussion_audience_members member
    where member.discussion_id = p_discussion_id
      and member.user_id = p_viewer_user_id
      and member.access_kind = 'include'
  ) into explicitly_included;

  select exists (
    select 1
    from public.discussion_audience_members member
    where member.discussion_id = p_discussion_id
      and member.user_id = p_viewer_user_id
      and member.access_kind = 'exclude'
  ) into explicitly_excluded;

  if normalized_type = 'only_me' then
    return false;
  end if;

  if normalized_type = 'exclude_selected' then
    return not explicitly_excluded;
  end if;

  if normalized_type = 'selected' then
    return explicitly_included and not explicitly_excluded;
  end if;

  if normalized_type = 'followers' then
    return exists (
      select 1
      from public.follows relationship
      where relationship.follower_id = p_viewer_user_id
        and relationship.following_id = p_author_id
    );
  end if;

  if normalized_type = 'connections' then
    return exists (
      select 1
      from public.follows incoming
      where incoming.follower_id = p_viewer_user_id
        and incoming.following_id = p_author_id
    ) and exists (
      select 1
      from public.follows outgoing
      where outgoing.follower_id = p_author_id
        and outgoing.following_id = p_viewer_user_id
    );
  end if;

  if normalized_type = 'custom' then
    if normalized_base = 'public' then
      base_allowed := true;
    elsif normalized_base = 'followers' then
      base_allowed := exists (
        select 1
        from public.follows relationship
        where relationship.follower_id = p_viewer_user_id
          and relationship.following_id = p_author_id
      );
    elsif normalized_base = 'connections' then
      base_allowed := exists (
        select 1
        from public.follows incoming
        where incoming.follower_id = p_viewer_user_id
          and incoming.following_id = p_author_id
      ) and exists (
        select 1
        from public.follows outgoing
        where outgoing.follower_id = p_author_id
          and outgoing.following_id = p_viewer_user_id
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
  select
    preference.default_audience_type,
    preference.default_audience_base,
    preference.include_user_ids,
    preference.exclude_user_ids
  into preference_row
  from public.discussion_audience_preferences preference
  where preference.user_id = new.user_id;

  if found then
    requested_type := coalesce(
      nullif(preference_row.default_audience_type, ''),
      'public'
    );
    requested_base := coalesce(
      nullif(preference_row.default_audience_base, ''),
      'public'
    );
    include_ids := coalesce(preference_row.include_user_ids, '{}'::uuid[]);
    exclude_ids := coalesce(preference_row.exclude_user_ids, '{}'::uuid[]);
  end if;

  if requested_type not in (
    'public',
    'followers',
    'connections',
    'exclude_selected',
    'selected',
    'only_me',
    'custom'
  ) then
    requested_type := 'public';
  end if;

  if requested_type = 'custom'
    and requested_base not in ('public', 'followers', 'connections')
  then
    requested_base := 'public';
  end if;

  new.audience_type := requested_type;
  new.audience_base := case
    when requested_type = 'custom' then requested_base
    else null
  end;

  if requested_type in ('selected', 'custom')
    and cardinality(include_ids) > 0
  then
    insert into public.discussion_audience_members (
      discussion_id,
      user_id,
      access_kind
    )
    select new.id, selected.candidate_id, 'include'
    from unnest(include_ids) as selected(candidate_id)
    where selected.candidate_id <> new.user_id
    on conflict do nothing;
  end if;

  if requested_type in ('exclude_selected', 'custom')
    and cardinality(exclude_ids) > 0
  then
    insert into public.discussion_audience_members (
      discussion_id,
      user_id,
      access_kind
    )
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

drop trigger if exists aa_validate_discussion_audience_metadata_size_trigger
  on public.discussions;
drop function if exists public.validate_discussion_audience_metadata_size();

create or replace function public.prevent_discussion_audience_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.audience_type is distinct from old.audience_type
    or new.audience_base is distinct from old.audience_base
  then
    raise exception 'Discussion visibility is fixed when the Discussion is created.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_discussion_audience_change_trigger
  on public.discussions;
create trigger prevent_discussion_audience_change_trigger
before update of audience_type, audience_base on public.discussions
for each row execute function public.prevent_discussion_audience_change();

drop policy if exists discussion_audience_members_owner_write
  on public.discussion_audience_members;
revoke insert, update, delete
  on table public.discussion_audience_members
  from authenticated;

grant select
  on table public.discussion_audience_members
  to authenticated;

revoke all on function public.normalize_discussion_audience_preference()
  from public, anon, authenticated;
revoke all on function public.prevent_discussion_audience_change()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
