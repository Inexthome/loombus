create table if not exists public.private_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.private_messages(id) on delete cascade,
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_bucket text not null default 'message-attachments',
  storage_path text not null,
  public_url text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes integer not null,
  attachment_kind text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint private_message_attachments_kind_check check (attachment_kind in ('image', 'pdf')),
  constraint private_message_attachments_size_check check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  constraint private_message_attachments_sort_order_check check (sort_order >= 0 and sort_order <= 2),
  constraint private_message_attachments_unique_sort unique (message_id, sort_order)
);

create index if not exists private_message_attachments_message_idx
on public.private_message_attachments(message_id, sort_order);

create index if not exists private_message_attachments_conversation_idx
on public.private_message_attachments(conversation_id, created_at desc);

alter table public.private_message_attachments enable row level security;

revoke all on table public.private_message_attachments from anon;
revoke insert, update, delete on table public.private_message_attachments from authenticated;
grant select on table public.private_message_attachments to authenticated;

drop policy if exists "Conversation members can read private message attachments"
on public.private_message_attachments;

create policy "Conversation members can read private message attachments"
on public.private_message_attachments
for select
to authenticated
using (
  public.user_can_read_private_messages(conversation_id, auth.uid())
);

comment on table public.private_message_attachments is
  'Attachment records for private messages. Uploads are inserted by service-role APIs after validating conversation membership.';

comment on column public.private_message_attachments.storage_bucket is
  'Supabase Storage bucket name. Expected bucket: message-attachments.';
