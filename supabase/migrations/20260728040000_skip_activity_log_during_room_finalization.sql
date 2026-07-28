create or replace function public.log_room_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  row_data jsonb;
  old_data jsonb;
  target_room_id uuid;
  target_entity_id text;
  next_actor_id uuid;
begin
  if TG_OP = 'DELETE' then
    row_data := to_jsonb(OLD);
    old_data := to_jsonb(OLD);
  else
    row_data := to_jsonb(NEW);
    old_data := coalesce(to_jsonb(OLD), '{}'::jsonb);
  end if;

  if not (row_data ? 'room_id') then
    return coalesce(NEW, OLD);
  end if;

  target_room_id := nullif(row_data ->> 'room_id', '')::uuid;
  target_entity_id := coalesce(
    row_data ->> 'id',
    row_data ->> 'user_id',
    row_data ->> 'requester_user_id',
    row_data ->> 'invited_user_id',
    ''
  );
  next_actor_id := auth.uid();

  if target_room_id is null then
    return coalesce(NEW, OLD);
  end if;

  /*
   * Permanent Room deletion cascades through Room-owned tables after the
   * deletion job has entered finalizing. Do not create new activity rows
   * that reference the Room being permanently deleted.
   *
   * Direct child-row deletions outside permanent Room finalization continue
   * to generate normal activity events.
   */
  if TG_OP = 'DELETE'
     and exists (
       select 1
       from public.room_deletion_jobs deletion_job
       where deletion_job.room_id = target_room_id
         and deletion_job.status = 'finalizing'
     )
  then
    return OLD;
  end if;

  insert into public.room_activity_log (
    room_id,
    actor_id,
    event_type,
    entity_table,
    entity_id,
    summary,
    metadata
  ) values (
    target_room_id,
    next_actor_id,
    lower(TG_TABLE_NAME || '_' || TG_OP),
    TG_TABLE_NAME,
    target_entity_id,
    public.room_activity_summary(
      TG_TABLE_NAME,
      TG_OP,
      row_data,
      old_data
    ),
    jsonb_build_object(
      'operation', TG_OP,
      'table', TG_TABLE_NAME,
      'row', row_data,
      'old_row', old_data
    )
  );

  return coalesce(NEW, OLD);
end;
$function$;
