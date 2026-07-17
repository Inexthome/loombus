-- Harden Everything Search trigger execution after source adapters are installed.

begin;

revoke all on function public.sync_loombus_search_source()
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
