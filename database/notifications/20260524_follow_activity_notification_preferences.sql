-- Loombus follow-activity notification preferences
--
-- Purpose:
-- Add in-app notification preferences for activity from people a member follows.
--
-- New preferences:
-- - followed_discussions_enabled:
--   Notify a follower when someone they follow publishes a new discussion.
--
-- - followed_replies_enabled:
--   Notify a follower when someone they follow posts a reply.
--
-- followed_discussions_enabled defaults to true because it is central to the
-- following feed experience.
--
-- followed_replies_enabled defaults to false because replies can become noisy
-- quickly and should remain opt-in.

alter table public.notification_preferences
  add column if not exists followed_discussions_enabled boolean not null default true;

alter table public.notification_preferences
  add column if not exists followed_replies_enabled boolean not null default false;

update public.notification_preferences
set followed_discussions_enabled = true
where followed_discussions_enabled is null;

update public.notification_preferences
set followed_replies_enabled = false
where followed_replies_enabled is null;

comment on column public.notification_preferences.followed_discussions_enabled is
'Whether this member wants in-app notifications when people they follow publish new discussions.';

comment on column public.notification_preferences.followed_replies_enabled is
'Whether this member wants in-app notifications when people they follow post replies.';
