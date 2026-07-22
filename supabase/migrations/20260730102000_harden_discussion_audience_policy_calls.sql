-- Prevent callers from supplying another viewer id to audience checks.
-- RLS uses current-user wrappers while service-side search keeps the internal predicate.

begin;

create or replace function public.can_view_discussion_audience_row_for_current_user(
  p_discussion_id uuid,
  p_author_id uuid,
  p_audience_type text,
  p_audience_base text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_discussion_audience_row(
    p_discussion_id,
    p_author_id,
    p_audience_type,
    p_audience_base,
    auth.uid()
  );
$$;

create or replace function public.can_view_discussion_audience_for_current_user(
  p_discussion_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_discussion_audience(p_discussion_id, auth.uid());
$$;

drop policy if exists discussion_audience_select_restriction on public.discussions;
create policy discussion_audience_select_restriction
on public.discussions
as restrictive
for select
to public
using (
  public.can_view_discussion_audience_row_for_current_user(
    id,
    user_id,
    audience_type,
    audience_base
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
      execute format(
        'drop policy if exists discussion_audience_access_restriction on public.%I',
        target_table
      );

      if target_table = 'reply_reactions' then
        execute format(
          'create policy discussion_audience_access_restriction on public.%I as restrictive for all to public using (exists (select 1 from public.replies reply where reply.id = reply_id and public.can_view_discussion_audience_for_current_user(reply.discussion_id))) with check (exists (select 1 from public.replies reply where reply.id = reply_id and public.can_view_discussion_audience_for_current_user(reply.discussion_id)))',
          target_table
        );
      else
        execute format(
          'create policy discussion_audience_access_restriction on public.%I as restrictive for all to public using (public.can_view_discussion_audience_for_current_user(discussion_id)) with check (public.can_view_discussion_audience_for_current_user(discussion_id))',
          target_table
        );
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.can_view_discussion_audience_row(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.can_view_discussion_audience(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.can_view_discussion_audience_row(uuid, uuid, text, text, uuid)
  to service_role;
grant execute on function public.can_view_discussion_audience(uuid, uuid)
  to service_role;
grant execute on function public.can_view_discussion_audience_row_for_current_user(uuid, uuid, text, text)
  to anon, authenticated;
grant execute on function public.can_view_discussion_audience_for_current_user(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;
