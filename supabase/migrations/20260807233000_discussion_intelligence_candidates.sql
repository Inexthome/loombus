-- Phase 5 discussion intelligence foundation.
-- Returns a bounded, ranked candidate set across the full visible discussion without loading every reply body.

create or replace function public.get_discussion_intelligence_candidates(
  p_discussion_id uuid,
  p_limit integer default 60
)
returns table (
  reply_id uuid,
  user_id uuid,
  referenced_reply_id uuid,
  body text,
  created_at timestamptz,
  direct_response_count bigint,
  helpful_count bigint,
  insightful_count bigint,
  well_reasoned_count bigint,
  changed_view_count bigint,
  needs_evidence_count bigint,
  signal_total bigint,
  intelligence_score bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with visible_replies as (
    select r.id, r.user_id, r.referenced_reply_id, r.body, r.created_at
    from public.replies r
    where r.discussion_id = p_discussion_id
      and r.deleted_at is null
      and not exists (
        select 1
        from public.user_blocks ub
        where auth.uid() is not null
          and (
            (ub.blocker_id = auth.uid() and ub.blocked_id = r.user_id)
            or (ub.blocked_id = auth.uid() and ub.blocker_id = r.user_id)
          )
      )
  ),
  child_counts as (
    select r.referenced_reply_id as reply_id, count(*)::bigint as direct_response_count
    from visible_replies r
    where r.referenced_reply_id is not null
    group by r.referenced_reply_id
  ),
  reaction_counts as (
    select
      rr.reply_id,
      count(*) filter (where rr.reaction_type = 'helpful')::bigint as helpful_count,
      count(*) filter (where rr.reaction_type = 'insightful')::bigint as insightful_count,
      count(*) filter (where rr.reaction_type = 'well_reasoned')::bigint as well_reasoned_count,
      count(*) filter (where rr.reaction_type = 'changed_my_view')::bigint as changed_view_count,
      count(*) filter (where rr.reaction_type = 'needs_evidence')::bigint as needs_evidence_count,
      count(*)::bigint as signal_total
    from public.reply_reactions rr
    join visible_replies vr on vr.id = rr.reply_id
    group by rr.reply_id
  ),
  ranked as (
    select
      vr.id as reply_id,
      vr.user_id,
      vr.referenced_reply_id,
      vr.body,
      vr.created_at,
      coalesce(cc.direct_response_count, 0)::bigint as direct_response_count,
      coalesce(rc.helpful_count, 0)::bigint as helpful_count,
      coalesce(rc.insightful_count, 0)::bigint as insightful_count,
      coalesce(rc.well_reasoned_count, 0)::bigint as well_reasoned_count,
      coalesce(rc.changed_view_count, 0)::bigint as changed_view_count,
      coalesce(rc.needs_evidence_count, 0)::bigint as needs_evidence_count,
      coalesce(rc.signal_total, 0)::bigint as signal_total,
      (
        coalesce(cc.direct_response_count, 0) * 3
        + coalesce(rc.helpful_count, 0)
        + coalesce(rc.insightful_count, 0) * 2
        + coalesce(rc.well_reasoned_count, 0) * 2
        + coalesce(rc.changed_view_count, 0) * 4
        + coalesce(rc.needs_evidence_count, 0)
      )::bigint as intelligence_score
    from visible_replies vr
    left join child_counts cc on cc.reply_id = vr.id
    left join reaction_counts rc on rc.reply_id = vr.id
  )
  select *
  from ranked
  order by
    intelligence_score desc,
    changed_view_count desc,
    direct_response_count desc,
    signal_total desc,
    created_at desc,
    reply_id asc
  limit greatest(1, least(coalesce(p_limit, 60), 100));
$$;

grant execute on function public.get_discussion_intelligence_candidates(uuid, integer) to anon, authenticated;
