-- Bound audience lists and keep relationship discovery private to signed-in members.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'discussion_audience_preferences_include_limit_check'
      and conrelid = 'public.discussion_audience_preferences'::regclass
  ) then
    alter table public.discussion_audience_preferences
      add constraint discussion_audience_preferences_include_limit_check
      check (cardinality(include_user_ids) <= 250);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'discussion_audience_preferences_exclude_limit_check'
      and conrelid = 'public.discussion_audience_preferences'::regclass
  ) then
    alter table public.discussion_audience_preferences
      add constraint discussion_audience_preferences_exclude_limit_check
      check (cardinality(exclude_user_ids) <= 250);
  end if;
end;
$$;

create or replace function public.validate_discussion_audience_metadata_size()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.discussion_metadata, '{}'::jsonb);
  include_value text := coalesce(metadata ->> '__audience_include_ids', '');
  exclude_value text := coalesce(metadata ->> '__audience_exclude_ids', '');
  include_count integer := 0;
  exclude_count integer := 0;
begin
  if char_length(include_value) > 10000 or char_length(exclude_value) > 10000 then
    raise exception 'Audience selection is too large.' using errcode = '22001';
  end if;

  if include_value <> '' then
    include_count := 1 + char_length(include_value) - char_length(replace(include_value, ',', ''));
  end if;

  if exclude_value <> '' then
    exclude_count := 1 + char_length(exclude_value) - char_length(replace(exclude_value, ',', ''));
  end if;

  if include_count > 250 or exclude_count > 250 then
    raise exception 'Choose no more than 250 people in each audience list.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists aa_validate_discussion_audience_metadata_size_trigger
  on public.discussions;
create trigger aa_validate_discussion_audience_metadata_size_trigger
before insert on public.discussions
for each row execute function public.validate_discussion_audience_metadata_size();

create or replace function public.get_discussion_audience_candidates()
returns table (
  id uuid,
  full_name text,
  username text,
  avatar_url text,
  follows_you boolean,
  you_follow boolean,
  is_connection boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select auth.uid() as id
  ), relationships as (
    select
      profile.id,
      profile.full_name,
      profile.username,
      profile.avatar_url,
      exists (
        select 1
        from public.follows incoming
        where incoming.follower_id = profile.id
          and incoming.following_id = (select id from viewer)
      ) as follows_you,
      exists (
        select 1
        from public.follows outgoing
        where outgoing.follower_id = (select id from viewer)
          and outgoing.following_id = profile.id
      ) as you_follow
    from public.profiles profile
    where (select id from viewer) is not null
      and profile.id <> (select id from viewer)
      and coalesce(profile.account_status, 'active') not in (
        'blocked', 'deleted', 'deactivated', 'suspended', 'banned', 'pending_deletion'
      )
      and (
        exists (
          select 1
          from public.follows incoming
          where incoming.follower_id = profile.id
            and incoming.following_id = (select id from viewer)
        )
        or exists (
          select 1
          from public.follows outgoing
          where outgoing.follower_id = (select id from viewer)
            and outgoing.following_id = profile.id
        )
      )
      and not exists (
        select 1
        from public.user_blocks block
        where (block.blocker_id = profile.id and block.blocked_id = (select id from viewer))
           or (block.blocker_id = (select id from viewer) and block.blocked_id = profile.id)
      )
  )
  select
    relationships.id,
    relationships.full_name,
    relationships.username,
    relationships.avatar_url,
    relationships.follows_you,
    relationships.you_follow,
    relationships.follows_you and relationships.you_follow as is_connection
  from relationships
  order by
    (relationships.follows_you and relationships.you_follow) desc,
    lower(coalesce(relationships.full_name, relationships.username, '')) asc
  limit 500;
$$;

revoke all on function public.get_discussion_audience_capability()
  from public, anon, authenticated;
revoke all on function public.get_discussion_audience_candidates()
  from public, anon, authenticated;
grant execute on function public.get_discussion_audience_capability()
  to authenticated;
grant execute on function public.get_discussion_audience_candidates()
  to authenticated;

revoke all on function public.validate_discussion_audience_metadata_size()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
