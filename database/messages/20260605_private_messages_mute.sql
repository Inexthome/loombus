alter table public.private_conversation_members
add column if not exists muted_at timestamptz null;

comment on column public.private_conversation_members.muted_at is
'When set, notifications for this conversation are suppressed for the member until unmuted.';
