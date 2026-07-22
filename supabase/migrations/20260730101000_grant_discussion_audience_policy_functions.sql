-- Allow RLS policies to execute the audience row predicate while keeping helper internals private.

begin;

grant execute on function public.can_view_discussion_audience_row(uuid, uuid, text, text, uuid)
  to anon, authenticated, service_role;

grant execute on function public.can_view_discussion_audience(uuid, uuid)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
