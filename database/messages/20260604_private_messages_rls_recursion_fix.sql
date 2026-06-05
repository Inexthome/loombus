-- Fix private messages RLS recursion.
-- The original private_conversation_members SELECT policy queried
-- private_conversation_members from inside its own policy, causing:
-- infinite recursion detected in policy for relation "private_conversation_members".

create or replace function public.user_is_private_conversation_member(
  target_conversation_id uuid,
  target_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.private_conversation_members member
    where member.conversation_id = target_conversation_id
      and member.user_id = target_user_id
  );
$$;

create or replace function public.user_can_read_private_messages(
  target_conversation_id uuid,
  target_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.user_is_private_conversation_member(
      target_conversation_id,
      target_user_id
    )
    or public.user_is_loombus_admin(target_user_id);
$$;

grant execute on function public.user_is_private_conversation_member(uuid, uuid)
to authenticated;

grant execute on function public.user_can_read_private_messages(uuid, uuid)
to authenticated;

drop policy if exists "Users can read their private conversations"
on public.private_conversations;

create policy "Users can read their private conversations"
on public.private_conversations
for select
to authenticated
using (
  public.user_can_read_private_messages(id, auth.uid())
);

drop policy if exists "Users can read private conversation members"
on public.private_conversation_members;

create policy "Users can read private conversation members"
on public.private_conversation_members
for select
to authenticated
using (
  public.user_can_read_private_messages(conversation_id, auth.uid())
);

drop policy if exists "Users can read private messages"
on public.private_messages;

create policy "Users can read private messages"
on public.private_messages
for select
to authenticated
using (
  public.user_can_read_private_messages(conversation_id, auth.uid())
);

comment on function public.user_is_private_conversation_member(uuid, uuid) is
'Security definer helper used by private message RLS policies to avoid recursive policy evaluation on private_conversation_members.';

comment on function public.user_can_read_private_messages(uuid, uuid) is
'Security definer helper for private message conversation/member/message read policies. Allows conversation members and Loombus admins.';
