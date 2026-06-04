-- Loombus Private Messages Phase 1
-- Database foundation only.
-- No UI, routes, direct client writes, attachments, typing indicators, or read receipt UI.

create table if not exists public.private_conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  is_system boolean not null default false
);

create table if not exists public.private_conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_message_id uuid null,
  last_read_at timestamptz null,
  archived_at timestamptz null,
  deleted_at timestamptz null,
  constraint private_conversation_members_unique_user unique (conversation_id, user_id)
);

create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message_type text not null default 'text',
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz null,
  deleted_by_sender boolean not null default false,
  reported_count integer not null default 0,
  constraint private_messages_type_check check (message_type in ('text')),
  constraint private_messages_body_length_check check (char_length(trim(body)) between 1 and 4000),
  constraint private_messages_reported_count_check check (reported_count >= 0)
);

create index if not exists private_conversation_members_user_id_idx
on public.private_conversation_members(user_id);

create index if not exists private_conversation_members_conversation_id_idx
on public.private_conversation_members(conversation_id);

create index if not exists private_conversations_last_message_at_idx
on public.private_conversations(last_message_at desc nulls last);

create index if not exists private_messages_conversation_created_idx
on public.private_messages(conversation_id, created_at);

create index if not exists private_messages_sender_created_idx
on public.private_messages(sender_id, created_at desc);

alter table public.private_conversations enable row level security;
alter table public.private_conversation_members enable row level security;
alter table public.private_messages enable row level security;

revoke all on table public.private_conversations from anon;
revoke all on table public.private_conversation_members from anon;
revoke all on table public.private_messages from anon;

revoke insert, update, delete on table public.private_conversations from authenticated;
revoke insert, update, delete on table public.private_conversation_members from authenticated;
revoke insert, update, delete on table public.private_messages from authenticated;

grant select on table public.private_conversations to authenticated;
grant select on table public.private_conversation_members to authenticated;
grant select on table public.private_messages to authenticated;

drop policy if exists "Users can read their private conversations"
on public.private_conversations;

create policy "Users can read their private conversations"
on public.private_conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.private_conversation_members member
    where member.conversation_id = private_conversations.id
      and member.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_admin = true
  )
);

drop policy if exists "Users can read private conversation members"
on public.private_conversation_members;

create policy "Users can read private conversation members"
on public.private_conversation_members
for select
to authenticated
using (
  exists (
    select 1
    from public.private_conversation_members viewer_member
    where viewer_member.conversation_id = private_conversation_members.conversation_id
      and viewer_member.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_admin = true
  )
);

drop policy if exists "Users can read private messages"
on public.private_messages;

create policy "Users can read private messages"
on public.private_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.private_conversation_members member
    where member.conversation_id = private_messages.conversation_id
      and member.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_admin = true
  )
);

comment on table public.private_conversations is
'Private message conversation containers. Phase 1 database foundation only; visible UI and API routes are added later.';

comment on table public.private_conversation_members is
'Per-user membership and inbox state for private conversations. deleted_at hides a conversation for one user and does not hard-delete moderation evidence.';

comment on table public.private_messages is
'Private text messages. Phase 1 supports text-only messages; user deletion does not hard-delete records so reports and moderation history can be preserved.';

comment on column public.private_messages.message_type is
'Reserved for future message types. Phase 1 only allows text.';
