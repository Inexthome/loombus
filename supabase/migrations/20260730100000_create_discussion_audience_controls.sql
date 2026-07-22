-- Discussion audience controls for future Loombus discussions.
-- Restricted discussions remain out of feeds, direct reads, search, notifications,
-- replies, bookmarks, views, summaries, and public attachment storage unless the viewer is allowed.

begin;

alter table public.discussions
  add column if not exists audience_type text not null default 'public',
  add column if not exists audience_base text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'discussions_audience_type_check'
      and conrelid = 'public.discussions'::regclass
  ) then
    alter table public.discussions
      add constraint discussions_audience_type_check
      check (audience_type in ('public', 'followers', 'connections', 'selected', 'only_me', 'custom'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'discussions_audience_base_check'
      and conrelid = 'public.discussions'::regclass
  ) then
    alter table public.discussions
      add constraint discussions_audience_base_check
      check (
        (audience_type = 'custom' and audience_base in ('public', 'followers', 'connections'))
        or (audience_type <> 'custom' and audience_base is null)
      );
  end if;
end;
$$;

create table if not exists public.discussion_audience_members (
  discussion_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_kind text not null,
  created_at timestamptz not null default now(),
  primary key (discussion_id, user_id, access_kind),
  constraint discussion_audience_members_access_kind_check
    check (access_kind in ('include', 'exclude')),
  constraint discussion_audience_members_discussion_fk
    foreign key (discussion_id)
    references public.discussions(id)
    on delete cascade
    deferrable initially deferred
);

create index if not exists discussion_audience_members_user_idx
  on public.discussion_audience_members (user_id, discussion_id);

create table if not exists public.discussion_audience_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_audience_type text not null default 'public',
  default_audience_base text,
  include_user_ids uuid[] not null default '{}'::uuid[],
  exclude_user_ids uuid[] not null default '{}'::uuid[],
  updated_at timestamptz not null default now(),
  constraint discussion_audience_preferences_type_check
    check (default_audience_type in ('public', 'followers', 'connections', 'selected', 'only_me', 'custom')),
  constraint discussion_audience_preferences_base_check
    check (
      (default_audience_type = 'custom' and default_audience_base in ('public', 'followers', 'connections'))
      or (default_audience_type <> 'custom' and default_audience_base is null)
    )
);

alter table public.discussion_audience_members enable row level security;
alter table public.discussion_audience_preferences enable row level security;

create or replace function public.is_discussion_audience_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select profile.is_admin = true
    from public.profiles profile
    where profile.id = p_user_id
    limit 1
  ), false);
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

  if normalized_type = 'custom'
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
    where (block.blocker_id = p_author_id and block.blocked_id = p_viewer_user_id)
       or (block.blocker_id = p_viewer_user_id and block.blocked_id = p_author_id)
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

  if normalized_type = 'selected' then
    return explicitly_included and not explicitly_excluded;
  end if;

  if normalized_type = 'followers' then
    return exists (
      select 1
      from public.follows follow
      where follow.follower_id = p_viewer_user_id
        and follow.following_id = p_author_id
    );
  end if;

  if normalized_type = 'connections' then
    return exists (
      select 1
      from public.follows first_follow
      where first_follow.follower_id = p_viewer_user_id
        and first_follow.following_id = p_author_id
    ) and exists (
      select 1
      from public.follows second_follow
      where second_follow.follower_id = p_author_id
        and second_follow.following_id = p_viewer_user_id
    );
  end if;

  if normalized_type = 'custom' then
    if normalized_base = 'public' then
      base_allowed := true;
    elsif normalized_base = 'followers' then
      base_allowed := exists (
        select 1
        from public.follows follow
        where follow.follower_id = p_viewer_user_id
          and follow.following_id = p_author_id
      );
    elsif normalized_base = 'connections' then
      base_allowed := exists (
        select 1
        from public.follows first_follow
        where first_follow.follower_id = p_viewer_user_id
          and first_follow.following_id = p_author_id
      ) and exists (
        select 1
        from public.follows second_follow
        where second_follow.follower_id = p_author_id
          and second_follow.following_id = p_viewer_user_id
      );
    end if;

    return (base_allowed or explicitly_included) and not explicitly_excluded;
  end if;

  return false;
end;
$$;

create or replace function public.can_view_discussion_audience(
  p_discussion_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  discussion_row record;
begin
  select
    discussion.id,
    discussion.user_id,
    discussion.audience_type,
    discussion.audience_base,
    discussion.deleted_at
  into discussion_row
  from public.discussions discussion
  where discussion.id = p_discussion_id;

  if discussion_row.id is null or discussion_row.deleted_at is not null then
    return false;
  end if;

  return public.can_view_discussion_audience_row(
    discussion_row.id,
    discussion_row.user_id,
    discussion_row.audience_type,
    discussion_row.audience_base,
    p_viewer_user_id
  );
end;
$$;

create or replace function public.get_discussion_audience_capability()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

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
    lower(coalesce(relationships.full_name, relationships.username, '')) asc;
$$;

create or replace function public.parse_discussion_audience_uuid_csv(p_value text)
returns uuid[]
language sql
immutable
set search_path = public
as $$
  select coalesce(
    array_agg(distinct trim(token)::uuid)
      filter (where trim(token) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
    '{}'::uuid[]
  )
  from regexp_split_to_table(coalesce(p_value, ''), ',') as token;
$$;

create or replace function public.apply_discussion_audience_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb := coalesce(new.discussion_metadata, '{}'::jsonb);
  requested_type text := lower(coalesce(nullif(metadata ->> '__audience_type', ''), new.audience_type, 'public'));
  requested_base text := lower(coalesce(nullif(metadata ->> '__audience_base', ''), new.audience_base, 'public'));
  include_ids uuid[] := public.parse_discussion_audience_uuid_csv(metadata ->> '__audience_include_ids');
  exclude_ids uuid[] := public.parse_discussion_audience_uuid_csv(metadata ->> '__audience_exclude_ids');
  included_count integer := 0;
begin
  if requested_type not in ('public', 'followers', 'connections', 'selected', 'only_me', 'custom') then
    raise exception 'Choose a valid discussion audience.' using errcode = '23514';
  end if;

  if requested_type = 'custom' and requested_base not in ('public', 'followers', 'connections') then
    raise exception 'Choose a valid base audience for Custom.' using errcode = '23514';
  end if;

  new.audience_type := requested_type;
  new.audience_base := case when requested_type = 'custom' then requested_base else null end;

  if requested_type in ('selected', 'custom') and cardinality(include_ids) > 0 then
    insert into public.discussion_audience_members (discussion_id, user_id, access_kind)
    select new.id, candidate_id, 'include'
    from unnest(include_ids) as candidate_id
    where candidate_id <> new.user_id
      and exists (
        select 1
        from public.follows follow
        where (follow.follower_id = new.user_id and follow.following_id = candidate_id)
           or (follow.follower_id = candidate_id and follow.following_id = new.user_id)
      )
      and not exists (
        select 1
        from public.user_blocks block
        where (block.blocker_id = new.user_id and block.blocked_id = candidate_id)
           or (block.blocker_id = candidate_id and block.blocked_id = new.user_id)
      )
    on conflict do nothing;

    get diagnostics included_count = row_count;
  end if;

  if requested_type = 'custom' and cardinality(exclude_ids) > 0 then
    insert into public.discussion_audience_members (discussion_id, user_id, access_kind)
    select new.id, candidate_id, 'exclude'
    from unnest(exclude_ids) as candidate_id
    where candidate_id <> new.user_id
      and exists (
        select 1
        from public.follows follow
        where (follow.follower_id = new.user_id and follow.following_id = candidate_id)
           or (follow.follower_id = candidate_id and follow.following_id = new.user_id)
      )
    on conflict do nothing;
  end if;

  if requested_type = 'selected' and included_count = 0 then
    raise exception 'Choose at least one connected person for Selected people.' using errcode = '23514';
  end if;

  new.discussion_metadata := metadata
    - '__audience_type'
    - '__audience_base'
    - '__audience_include_ids'
    - '__audience_exclude_ids';

  return new;
end;
$$;

drop trigger if exists apply_discussion_audience_metadata_trigger on public.discussions;
create trigger apply_discussion_audience_metadata_trigger
before insert on public.discussions
for each row execute function public.apply_discussion_audience_metadata();

create or replace function public.prevent_restricted_discussion_public_attachments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.discussions discussion
    where discussion.id = new.discussion_id
      and discussion.audience_type <> 'public'
  ) then
    raise exception 'Attachments are currently available only for Public discussions. Remove the attachment or choose Public.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_restricted_discussion_public_attachments_trigger
  on public.discussion_attachments;
create trigger prevent_restricted_discussion_public_attachments_trigger
before insert or update of discussion_id on public.discussion_attachments
for each row execute function public.prevent_restricted_discussion_public_attachments();

create or replace function public.enforce_discussion_notification_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_discussion_id uuid;
begin
  if new.target_type = 'discussion' then
    parent_discussion_id := new.target_id;
  elsif new.target_type = 'reply' then
    select reply.discussion_id
    into parent_discussion_id
    from public.replies reply
    where reply.id = new.target_id;
  end if;

  if parent_discussion_id is not null
    and not public.can_view_discussion_audience(parent_discussion_id, new.user_id)
  then
    return null;
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.notifications') is not null then
    execute 'drop trigger if exists enforce_discussion_notification_audience_trigger on public.notifications';
    execute 'create trigger enforce_discussion_notification_audience_trigger before insert on public.notifications for each row execute function public.enforce_discussion_notification_audience()';
  end if;
end;
$$;

create or replace function public.sync_discussion_audience_search_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_discussion_id uuid;
  parent_audience_type text;
  public_visibility text := 'public';
begin
  if to_regclass('public.loombus_search_documents') is null then
    return new;
  end if;

  if tg_table_name = 'discussions' then
    parent_discussion_id := new.id;
  else
    parent_discussion_id := new.discussion_id;
  end if;

  select discussion.audience_type
  into parent_audience_type
  from public.discussions discussion
  where discussion.id = parent_discussion_id;

  if tg_table_name = 'discussion_summaries' then
    public_visibility := 'premium';
  end if;

  update public.loombus_search_documents document
  set visibility = case
    when coalesce(parent_audience_type, 'public') = 'public' then public_visibility
    else 'private'
  end
  where document.source_table = tg_table_name
    and document.entity_id = new.id;

  if tg_table_name = 'discussions' then
    update public.loombus_search_documents document
    set visibility = case
      when coalesce(parent_audience_type, 'public') = 'public'
        then case when document.source_table = 'discussion_summaries' then 'premium' else 'public' end
      else 'private'
    end
    where document.parent_id = parent_discussion_id
      and document.source_table in ('replies', 'discussion_summaries', 'discussion_attachments');
  end if;

  return new;
end;
$$;

do $$
declare
  source_table text;
begin
  if to_regclass('public.loombus_search_documents') is not null then
    foreach source_table in array array[
      'discussions',
      'replies',
      'discussion_summaries',
      'discussion_attachments'
    ]
    loop
      execute format(
        'drop trigger if exists %I on public.%I',
        'zz_sync_discussion_audience_search_' || source_table,
        source_table
      );
      execute format(
        'create trigger %I after insert or update on public.%I for each row execute function public.sync_discussion_audience_search_visibility()',
        'zz_sync_discussion_audience_search_' || source_table,
        source_table
      );
    end loop;

    update public.loombus_search_documents document
    set visibility = case
      when coalesce(discussion.audience_type, 'public') = 'public'
        then case when document.source_table = 'discussion_summaries' then 'premium' else 'public' end
      else 'private'
    end
    from public.discussions discussion
    where document.source_table in ('discussions', 'replies', 'discussion_summaries', 'discussion_attachments')
      and discussion.id = case
        when document.source_table = 'discussions' then document.entity_id
        else document.parent_id
      end;
  end if;
end;
$$;

create or replace function public.search_loombus_documents(
  search_text text,
  viewer_user_id uuid default null,
  viewer_has_premium boolean default false,
  result_limit integer default 60
)
returns table (
  document_id uuid,
  entity_type text,
  entity_id uuid,
  parent_id uuid,
  room_id uuid,
  owner_id uuid,
  title text,
  snippet text,
  href text,
  visibility text,
  signal_score numeric,
  source_created_at timestamptz,
  metadata jsonb,
  rank real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  clean_query text := trim(coalesce(search_text, ''));
  capped_limit integer := least(greatest(coalesce(result_limit, 60), 1), 100);
  query_tree tsquery;
begin
  if char_length(clean_query) < 2 then
    return;
  end if;

  query_tree := websearch_to_tsquery('simple', clean_query);

  return query
  with accessible as (
    select
      document.*,
      ts_rank_cd(document.search_vector, query_tree)::real as lexical_rank,
      case
        when lower(document.title) = lower(clean_query) then 0.75
        when lower(document.title) like lower(clean_query) || '%' then 0.5
        when document.title ilike '%' || clean_query || '%' then 0.3
        else 0
      end::real as title_boost,
      greatest(
        0,
        0.12 - (
          extract(epoch from (now() - coalesce(document.source_created_at, document.created_at)))
          / 315576000
        )
      )::real as recency_boost
    from public.loombus_search_documents document
    where document.status = 'active'
      and (
        (
          document.source_table in ('discussions', 'replies', 'discussion_summaries', 'discussion_attachments')
          and public.can_view_discussion_audience(
            case
              when document.source_table = 'discussions' then document.entity_id
              else document.parent_id
            end,
            viewer_user_id
          )
          and (
            document.source_table <> 'discussion_summaries'
            or (viewer_user_id is not null and viewer_has_premium)
          )
        )
        or (
          document.source_table not in ('discussions', 'replies', 'discussion_summaries', 'discussion_attachments')
          and (
            document.visibility = 'public'
            or (viewer_user_id is not null and document.visibility = 'authenticated')
            or (viewer_user_id is not null and viewer_has_premium and document.visibility = 'premium')
            or (
              viewer_user_id is not null
              and document.visibility = 'private'
              and document.owner_id = viewer_user_id
            )
            or (
              viewer_user_id is not null
              and document.visibility = 'member'
              and document.room_id is not null
              and (
                exists (
                  select 1
                  from public.rooms room
                  where room.id = document.room_id
                    and (room.owner_id = viewer_user_id or room.created_by = viewer_user_id)
                )
                or exists (
                  select 1
                  from public.room_members member
                  where member.room_id = document.room_id
                    and member.user_id = viewer_user_id
                    and coalesce(member.status, 'active') not in ('blocked', 'removed', 'inactive')
                    and (member.suspended_until is null or member.suspended_until <= now())
                )
              )
            )
          )
        )
      )
      and (
        document.source_table not in ('replies', 'discussion_summaries', 'discussion_attachments')
        or exists (
          select 1
          from public.discussions parent_discussion
          where parent_discussion.id = document.parent_id
            and parent_discussion.deleted_at is null
        )
      )
      and (
        document.search_vector @@ query_tree
        or document.title ilike '%' || clean_query || '%'
        or document.summary ilike '%' || clean_query || '%'
        or document.body ilike '%' || clean_query || '%'
      )
  )
  select
    accessible.id,
    accessible.entity_type,
    accessible.entity_id,
    accessible.parent_id,
    accessible.room_id,
    accessible.owner_id,
    accessible.title,
    left(coalesce(nullif(accessible.summary, ''), nullif(accessible.body, ''), ''), 700),
    accessible.href,
    accessible.visibility,
    accessible.signal_score,
    accessible.source_created_at,
    accessible.metadata,
    (
      accessible.lexical_rank
      + accessible.title_boost
      + accessible.recency_boost
      + least(greatest(accessible.signal_score, 0) / 400, 0.25)
    )::real
  from accessible
  order by
    (
      accessible.lexical_rank
      + accessible.title_boost
      + accessible.recency_boost
      + least(greatest(accessible.signal_score, 0) / 400, 0.25)
    ) desc,
    accessible.source_created_at desc nulls last
  limit capped_limit;
end;
$$;

alter table public.discussions enable row level security;

drop policy if exists discussion_audience_select_restriction on public.discussions;
create policy discussion_audience_select_restriction
on public.discussions
as restrictive
for select
to public
using (
  public.can_view_discussion_audience_row(
    id,
    user_id,
    audience_type,
    audience_base,
    auth.uid()
  )
);

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'replies',
    'discussion_tags',
    'discussion_attachments',
    'discussion_summaries',
    'discussion_views',
    'bookmarks',
    'reply_reactions'
  ]
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('alter table public.%I enable row level security', target_table);
      execute format('drop policy if exists discussion_audience_access_restriction on public.%I', target_table);

      if target_table = 'reply_reactions' then
        execute format(
          'create policy discussion_audience_access_restriction on public.%I as restrictive for all to public using (exists (select 1 from public.replies reply where reply.id = reply_id and public.can_view_discussion_audience(reply.discussion_id, auth.uid()))) with check (exists (select 1 from public.replies reply where reply.id = reply_id and public.can_view_discussion_audience(reply.discussion_id, auth.uid())))',
          target_table
        );
      else
        execute format(
          'create policy discussion_audience_access_restriction on public.%I as restrictive for all to public using (public.can_view_discussion_audience(discussion_id, auth.uid())) with check (public.can_view_discussion_audience(discussion_id, auth.uid()))',
          target_table
        );
      end if;
    end if;
  end loop;
end;
$$;

drop policy if exists discussion_audience_members_owner_select on public.discussion_audience_members;
create policy discussion_audience_members_owner_select
on public.discussion_audience_members
for select
to authenticated
using (
  exists (
    select 1
    from public.discussions discussion
    where discussion.id = discussion_id
      and (discussion.user_id = auth.uid() or public.is_discussion_audience_admin(auth.uid()))
  )
);

drop policy if exists discussion_audience_members_owner_write on public.discussion_audience_members;
create policy discussion_audience_members_owner_write
on public.discussion_audience_members
for all
to authenticated
using (
  exists (
    select 1
    from public.discussions discussion
    where discussion.id = discussion_id
      and (discussion.user_id = auth.uid() or public.is_discussion_audience_admin(auth.uid()))
  )
)
with check (
  exists (
    select 1
    from public.discussions discussion
    where discussion.id = discussion_id
      and (discussion.user_id = auth.uid() or public.is_discussion_audience_admin(auth.uid()))
  )
);

drop policy if exists discussion_audience_preferences_owner on public.discussion_audience_preferences;
create policy discussion_audience_preferences_owner
on public.discussion_audience_preferences
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

revoke all on table public.discussion_audience_members from public, anon;
revoke all on table public.discussion_audience_preferences from public, anon;
grant select, insert, update, delete on table public.discussion_audience_members to authenticated;
grant select, insert, update, delete on table public.discussion_audience_preferences to authenticated;

grant execute on function public.get_discussion_audience_capability() to authenticated;
grant execute on function public.get_discussion_audience_candidates() to authenticated;
grant execute on function public.can_view_discussion_audience(uuid, uuid) to anon, authenticated, service_role;

revoke all on function public.is_discussion_audience_admin(uuid) from public, anon, authenticated;
revoke all on function public.can_view_discussion_audience_row(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.parse_discussion_audience_uuid_csv(text) from public, anon, authenticated;
revoke all on function public.apply_discussion_audience_metadata() from public, anon, authenticated;
revoke all on function public.prevent_restricted_discussion_public_attachments() from public, anon, authenticated;
revoke all on function public.enforce_discussion_notification_audience() from public, anon, authenticated;
revoke all on function public.sync_discussion_audience_search_visibility() from public, anon, authenticated;

revoke all on function public.search_loombus_documents(text, uuid, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.search_loombus_documents(text, uuid, boolean, integer)
  to service_role;

notify pgrst, 'reload schema';

commit;
