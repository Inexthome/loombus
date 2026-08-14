begin;

grant select, insert, update
on table public.user_general_subscriptions
to service_role;

grant select
on table public.teen_safety_settings
to service_role;

notify pgrst, 'reload schema';

commit;
