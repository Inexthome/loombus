insert into public.loombus_feature_flags (key, enabled, rollout_percentage, allowed_user_ids)
values ('v2_create_publish_enabled', false, 0, '{}')
on conflict (key) do nothing;

comment on table public.loombus_feature_flags is
  'Feature flags and rollback controls. v2_create_publish_enabled is the V2 Create publish kill-switch and defaults off.';
