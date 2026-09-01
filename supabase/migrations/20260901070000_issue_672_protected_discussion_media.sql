-- Issue #672: restricted Discussion attachments must not have permanent public URLs.
-- Existing storage_bucket/storage_path columns remain the object locator.

alter table public.discussion_attachments
  alter column public_url drop not null;

insert into storage.buckets (id, name, public)
values (
  'discussion-attachments-protected',
  'discussion-attachments-protected',
  false
)
on conflict (id) do update
set public = false;

-- Protected objects intentionally have no direct SELECT policy. Reads are authorized
-- by the application against can_view_discussion_audience and delivered using a
-- short-lived signed Storage URL. Uploads likewise use one-time signed upload tokens.
