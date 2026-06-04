alter table public.private_messages
add column if not exists read_by_recipient_at timestamptz;

comment on column public.private_messages.read_by_recipient_at is
'Internal read tracking for unread counts and inbox state. Not exposed as user-visible read receipts in Phase 1.';
