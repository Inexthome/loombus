-- Everything Search backfill and privacy-enforcing query contract.

begin;

do $$
declare
  payload jsonb;
begin
  for payload in select to_jsonb(source) from public.discussions source loop
    perform public.index_loombus_search_payload('discussions', payload);
  end loop;
  for payload in select to_jsonb(source) from public.replies source loop
    perform public.index_loombus_search_payload('replies', payload);
  end loop;
  for payload in select to_jsonb(source) from public.discussion_summaries source loop
    perform public.index_loombus_search_payload('discussion_summaries', payload);
  end loop;
  for payload in select to_jsonb(source) from public.discussion_attachments source loop
    perform public.index_loombus_search_payload('discussion_attachments', payload);
  end loop;
  for payload in select to_jsonb(source) from public.profiles source loop
    perform public.index_loombus_search_payload('profiles', payload);
  end loop;
  for payload in select to_jsonb(source) from public.rooms source loop
    perform public.index_loombus_search_payload('rooms', payload);
  end loop;
  for payload in select to_jsonb(source) from public.room_posts source loop
    perform public.index_loombus_search_payload('room_posts', payload);
  end loop;
  for payload in select to_jsonb(source) from public.room_announcements source loop
    perform public.index_loombus_search_payload('room_announcements', payload);
  end loop;
  for payload in select to_jsonb(source) from public.room_events source loop
    perform public.index_loombus_search_payload('room_events', payload);
  end loop;
  for payload in select to_jsonb(source) from public.room_module_records source loop
    perform public.index_loombus_search_payload('room_module_records', payload);
  end loop;
  for payload in select to_jsonb(source) from public.room_resources source loop
    perform public.index_loombus_search_payload('room_resources', payload);
  end loop;
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
        document.visibility = 'public'
        or (
          viewer_user_id is not null
          and document.visibility = 'authenticated'
        )
        or (
          viewer_user_id is not null
          and viewer_has_premium
          and document.visibility = 'premium'
        )
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
                and (
                  room.owner_id = viewer_user_id
                  or room.created_by = viewer_user_id
                )
            )
            or exists (
              select 1
              from public.room_members member
              where member.room_id = document.room_id
                and member.user_id = viewer_user_id
                and coalesce(member.status, 'active')
                  not in ('blocked', 'removed', 'inactive')
                and (
                  member.suspended_until is null
                  or member.suspended_until <= now()
                )
            )
          )
        )
      )
      and (
        document.source_table not in (
          'replies',
          'discussion_summaries',
          'discussion_attachments'
        )
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
    left(
      coalesce(
        nullif(accessible.summary, ''),
        nullif(accessible.body, ''),
        ''
      ),
      700
    ),
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

revoke all on function public.search_loombus_documents(text, uuid, boolean, integer)
  from public, anon, authenticated;

grant execute on function public.search_loombus_documents(text, uuid, boolean, integer)
  to service_role;

notify pgrst, 'reload schema';

commit;
