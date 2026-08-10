-- Read-only readiness checks for the Loombus Library data foundation.
-- Expected result: all boolean columns are true after the migration is applied.

select
  to_regclass('public.library_publications') is not null as publications_present,
  to_regclass('public.library_member_items') is not null as member_items_present,
  to_regclass('public.library_reading_progress') is not null as reading_progress_present,
  to_regclass('public.library_highlights') is not null as highlights_present,
  to_regclass('public.library_notes') is not null as notes_present,
  coalesce((select relrowsecurity from pg_class where oid = 'public.library_publications'::regclass), false) as publications_rls,
  coalesce((select relrowsecurity from pg_class where oid = 'public.library_member_items'::regclass), false) as member_items_rls,
  coalesce((select relrowsecurity from pg_class where oid = 'public.library_reading_progress'::regclass), false) as reading_progress_rls,
  coalesce((select relrowsecurity from pg_class where oid = 'public.library_highlights'::regclass), false) as highlights_rls,
  coalesce((select relrowsecurity from pg_class where oid = 'public.library_notes'::regclass), false) as notes_rls,
  not has_table_privilege('anon', 'public.library_publications', 'SELECT') as anon_publications_select_revoked,
  not has_table_privilege('anon', 'public.library_member_items', 'SELECT') as anon_member_items_select_revoked,
  not has_table_privilege('anon', 'public.library_reading_progress', 'SELECT') as anon_progress_select_revoked,
  not has_table_privilege('anon', 'public.library_highlights', 'SELECT') as anon_highlights_select_revoked,
  not has_table_privilege('anon', 'public.library_notes', 'SELECT') as anon_notes_select_revoked;
