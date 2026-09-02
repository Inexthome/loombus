-- Issue #673: private-message attachments are private application content.
-- This migration intentionally does not create a malware-scanning verdict. It
-- closes public Storage delivery while the platform remains in the documented
-- validation-only malware posture.

do $$
begin
  if to_regclass('public.private_message_attachments') is not null then
    alter table public.private_message_attachments
      alter column public_url drop not null;
  end if;
end
$$;

update storage.buckets
set public = false
where id = 'message-attachments';

comment on column public.private_message_attachments.public_url is
  'Legacy compatibility field. Private-message attachments are delivered through short-lived authorized signed URLs; this value must not be treated as a durable public delivery URL.';
