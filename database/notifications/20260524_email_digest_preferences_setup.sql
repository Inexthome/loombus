-- Loombus email digest notification preferences
--
-- Purpose:
-- Add explicit opt-in controls for daily/weekly email digests.
--
-- Email sending remains disabled unless application environment variables are
-- configured, including an email provider API key and sender address.

alter table public.notification_preferences
  add column if not exists email_digest_enabled boolean not null default false;

alter table public.notification_preferences
  add column if not exists email_digest_frequency text not null default 'weekly';

alter table public.notification_preferences
  add column if not exists email_digest_last_sent_at timestamptz;

alter table public.notification_preferences
  drop constraint if exists notification_preferences_email_digest_frequency_check;

alter table public.notification_preferences
  add constraint notification_preferences_email_digest_frequency_check
  check (email_digest_frequency in ('daily', 'weekly'));

update public.notification_preferences
set email_digest_enabled = false
where email_digest_enabled is null;

update public.notification_preferences
set email_digest_frequency = 'weekly'
where email_digest_frequency is null
   or email_digest_frequency not in ('daily', 'weekly');

create index if not exists notification_preferences_email_digest_idx
on public.notification_preferences(email_digest_enabled, email_digest_frequency, email_digest_last_sent_at);

comment on column public.notification_preferences.email_digest_enabled is
'Whether this member opted in to email digests.';

comment on column public.notification_preferences.email_digest_frequency is
'Email digest frequency: daily or weekly.';

comment on column public.notification_preferences.email_digest_last_sent_at is
'Timestamp when the latest email digest was successfully sent.';
