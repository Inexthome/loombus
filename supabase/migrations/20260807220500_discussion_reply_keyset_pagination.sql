-- Phase 3 discussion scaling foundation.
-- Adds keyset-pagination helpers for root discussion responses and direct point-thread children.

create index if not exists replies_discussion_created_id_active_idx
  on public.replies (discussion_id, created_at, id)
  where deleted_at is null;

create index if not exists replies_discussion_parent_created_id_active_idx
  on public.replies (discussion_id, referenced_reply_id, created_at, id)
  where deleted_at is null;

create index if not exists reply_reactions_reply_type_idx
  on public.reply_reactions (reply_id, reaction_type);

create or replace function public.get_discussion_root_reply_page(
  p_discussion_id uuid,
  p_sort text default 'best',
  p_limit integer default 30,
  p_cursor_signal bigint default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  reply_id uuid,
  signal_total bigint,
  created_at timestamptz,
  total_root_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with visible_roots as (
    select
      r.id,
      r.created_at,
      count(rr.reply_id)::bigint as signal_total
    from public.replies r
    left join public.reply_reactions rr on rr.reply_id = r.id
    where r.discussion_id = p_discussion_id
      and r.deleted_at is null
      and (
        r.referenced_reply_id is null
        or not exists (
          select 1
          from public.replies parent
          where parent.id = r.referenced_reply_id
            and parent.discussion_id = p_discussion_id
            and parent.deleted_at is null
        )
      )
    group by r.id, r.created_at
  ), ranked as (
    select
      vr.*,
      count(*) over ()::bigint as total_root_count
    from visible_roots vr
  )
  select
    ranked.id as reply_id,
    ranked.signal_total,
    ranked.created_at,
    ranked.total_root_count
  from ranked
  where
    case
      when p_sort = 'newest' and p_cursor_created_at is not null and p_cursor_id is not null then
        (ranked.created_at, ranked.id) < (p_cursor_created_at, p_cursor_id)
      when p_sort = 'oldest' and p_cursor_created_at is not null and p_cursor_id is not null then
        (ranked.created_at, ranked.id) > (p_cursor_created_at, p_cursor_id)
      when coalesce(p_sort, 'best') = 'best'
        and p_cursor_signal is not null
        and p_cursor_created_at is not null
        and p_cursor_id is not null then
          ranked.signal_total < p_cursor_signal
          or (
            ranked.signal_total = p_cursor_signal
            and (
              ranked.created_at > p_cursor_created_at
              or (ranked.created_at = p_cursor_created_at and ranked.id > p_cursor_id)
            )
          )
      else true
    end
  order by
    case when coalesce(p_sort, 'best') = 'best' then ranked.signal_total end desc,
    case when coalesce(p_sort, 'best') = 'best' then ranked.created_at end asc,
    case when coalesce(p_sort, 'best') = 'best' then ranked.id end asc,
    case when p_sort = 'newest' then ranked.created_at end desc,
    case when p_sort = 'newest' then ranked.id end desc,
    case when p_sort = 'oldest' then ranked.created_at end asc,
    case when p_sort = 'oldest' then ranked.id end asc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

create or replace function public.get_discussion_child_reply_page(
  p_discussion_id uuid,
  p_parent_reply_id uuid,
  p_sort text default 'best',
  p_limit integer default 30,
  p_cursor_signal bigint default null,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns table (
  reply_id uuid,
  signal_total bigint,
  created_at timestamptz,
  total_child_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with direct_children as (
    select
      r.id,
      r.created_at,
      count(rr.reply_id)::bigint as signal_total
    from public.replies r
    left join public.reply_reactions rr on rr.reply_id = r.id
    where r.discussion_id = p_discussion_id
      and r.deleted_at is null
      and r.referenced_reply_id = p_parent_reply_id
    group by r.id, r.created_at
  ), ranked as (
    select
      dc.*,
      count(*) over ()::bigint as total_child_count
    from direct_children dc
  )
  select
    ranked.id as reply_id,
    ranked.signal_total,
    ranked.created_at,
    ranked.total_child_count
  from ranked
  where
    case
      when p_sort = 'newest' and p_cursor_created_at is not null and p_cursor_id is not null then
        (ranked.created_at, ranked.id) < (p_cursor_created_at, p_cursor_id)
      when p_sort = 'oldest' and p_cursor_created_at is not null and p_cursor_id is not null then
        (ranked.created_at, ranked.id) > (p_cursor_created_at, p_cursor_id)
      when coalesce(p_sort, 'best') = 'best'
        and p_cursor_signal is not null
        and p_cursor_created_at is not null
        and p_cursor_id is not null then
          ranked.signal_total < p_cursor_signal
          or (
            ranked.signal_total = p_cursor_signal
            and (
              ranked.created_at > p_cursor_created_at
              or (ranked.created_at = p_cursor_created_at and ranked.id > p_cursor_id)
            )
          )
      else true
    end
  order by
    case when coalesce(p_sort, 'best') = 'best' then ranked.signal_total end desc,
    case when coalesce(p_sort, 'best') = 'best' then ranked.created_at end asc,
    case when coalesce(p_sort, 'best') = 'best' then ranked.id end asc,
    case when p_sort = 'newest' then ranked.created_at end desc,
    case when p_sort = 'newest' then ranked.id end desc,
    case when p_sort = 'oldest' then ranked.created_at end asc,
    case when p_sort = 'oldest' then ranked.id end asc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

grant execute on function public.get_discussion_root_reply_page(uuid, text, integer, bigint, timestamptz, uuid) to anon, authenticated;
grant execute on function public.get_discussion_child_reply_page(uuid, uuid, text, integer, bigint, timestamptz, uuid) to anon, authenticated;
