-- Repair a stale announcement-style trigger attached to public.room_posts.
--
-- Symptom when creating a structured Room discussion:
--   record "new" has no field "is_pinned"
--
-- public.room_posts intentionally does not have an is_pinned column. The error is
-- produced by a trigger function written for a different row shape, such as
-- public.room_announcements, being attached to public.room_posts. Do not mask the
-- defect by adding an unrelated column to Room discussions. Remove only the
-- trigger attachment whose function directly dereferences NEW.is_pinned or
-- OLD.is_pinned. The trigger function itself is retained for its correct table.

begin;

do $repair$
declare
  trigger_row record;
  removed_count integer := 0;
begin
  if to_regclass('public.room_posts') is null then
    raise exception
      'public.room_posts is missing; refusing to run the stale is_pinned trigger repair.';
  end if;

  for trigger_row in
    select
      trigger_definition.tgname as trigger_name,
      function_namespace.nspname as function_schema,
      trigger_function.proname as function_name
    from pg_trigger trigger_definition
    join pg_proc trigger_function
      on trigger_function.oid = trigger_definition.tgfoid
    join pg_namespace function_namespace
      on function_namespace.oid = trigger_function.pronamespace
    where trigger_definition.tgrelid = 'public.room_posts'::regclass
      and not trigger_definition.tgisinternal
      and (
        regexp_replace(
          lower(pg_get_functiondef(trigger_function.oid)),
          '[[:space:]]+',
          '',
          'g'
        ) like '%new.is_pinned%'
        or regexp_replace(
          lower(pg_get_functiondef(trigger_function.oid)),
          '[[:space:]]+',
          '',
          'g'
        ) like '%old.is_pinned%'
      )
  loop
    raise notice
      'Dropping stale trigger %.% from public.room_posts because function %.% directly accesses is_pinned.',
      'public',
      trigger_row.trigger_name,
      trigger_row.function_schema,
      trigger_row.function_name;

    execute format(
      'drop trigger if exists %I on public.room_posts',
      trigger_row.trigger_name
    );
    removed_count := removed_count + 1;
  end loop;

  raise notice
    'Room discussion stale is_pinned trigger repair removed % trigger attachment(s).',
    removed_count;
end;
$repair$;

-- Fail the migration rather than silently leaving the production defect active.
do $assertion$
declare
  stale_trigger_count integer;
begin
  select count(*)
  into stale_trigger_count
  from pg_trigger trigger_definition
  join pg_proc trigger_function
    on trigger_function.oid = trigger_definition.tgfoid
  where trigger_definition.tgrelid = 'public.room_posts'::regclass
    and not trigger_definition.tgisinternal
    and (
      regexp_replace(
        lower(pg_get_functiondef(trigger_function.oid)),
        '[[:space:]]+',
        '',
        'g'
      ) like '%new.is_pinned%'
      or regexp_replace(
        lower(pg_get_functiondef(trigger_function.oid)),
        '[[:space:]]+',
        '',
        'g'
      ) like '%old.is_pinned%'
    );

  if stale_trigger_count <> 0 then
    raise exception
      'Room discussion repair failed: % stale is_pinned trigger attachment(s) remain on public.room_posts.',
      stale_trigger_count;
  end if;
end;
$assertion$;

notify pgrst, 'reload schema';

commit;
