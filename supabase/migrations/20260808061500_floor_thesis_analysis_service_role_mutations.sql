-- The Floor analysis route claims a row before provider generation, then
-- updates it with the completed steelman/red-team/blind-spots output. If the
-- provider call fails, it deletes the incomplete claim. The original schema
-- granted service_role SELECT + INSERT only, which made both UPDATE and DELETE
-- fail at runtime even though the route intentionally uses the service client.

begin;

grant select, insert, update, delete
on table public.floor_thesis_analyses
 to service_role;

do $$
begin
  if not has_table_privilege('service_role', 'public.floor_thesis_analyses', 'SELECT')
     or not has_table_privilege('service_role', 'public.floor_thesis_analyses', 'INSERT')
     or not has_table_privilege('service_role', 'public.floor_thesis_analyses', 'UPDATE')
     or not has_table_privilege('service_role', 'public.floor_thesis_analyses', 'DELETE')
  then
    raise exception 'service_role must have SELECT/INSERT/UPDATE/DELETE on floor_thesis_analyses';
  end if;
end;
$$;

commit;
