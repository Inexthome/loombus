-- Loombus Library authenticated author EPUB upload foundation.
--
-- Establishes owner-scoped source preparation and private Storage authorization for
-- editable author publications. This does not add upload UI or ingestion orchestration.
-- The original bucket remains private; access is limited to the exact source path for
-- the authenticated publication owner while the canonical publication is still draft.

create or replace function public.library_current_user_can_access_original(
  p_storage_path text,
  p_write boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.library_publication_sources s
    join public.library_author_publications a
      on a.publication_id = s.publication_id
    join public.library_publications p
      on p.id = s.publication_id
    where s.storage_provider = 'supabase'
      and s.storage_bucket = 'library-publication-originals'
      and s.storage_path = p_storage_path
      and a.user_id = auth.uid()
      and p.status = 'draft'
      and (
        p_write is false
        or a.submission_status in ('draft', 'changes_requested')
      )
  );
$$;

revoke all on function public.library_current_user_can_access_original(text, boolean) from public;
grant execute on function public.library_current_user_can_access_original(text, boolean) to authenticated;

-- Authors may inspect source/ingestion metadata for publications they own. This does not
-- grant direct mutation privileges on source metadata.
drop policy if exists "authors read own library publication sources" on public.library_publication_sources;
create policy "authors read own library publication sources"
  on public.library_publication_sources
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.library_author_publications a
      where a.publication_id = library_publication_sources.publication_id
        and a.user_id = auth.uid()
    )
  );

grant select on public.library_publication_sources to authenticated;

create or replace function public.prepare_library_author_epub_source(
  p_publication_id uuid,
  p_byte_size bigint,
  p_sha256 text
)
returns table (
  source_id uuid,
  storage_bucket text,
  storage_path text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission_status text;
  v_publication_status text;
  v_source_id uuid;
  v_storage_path text;
begin
  if v_user_id is null then
    raise exception 'library_epub_auth_required';
  end if;

  if p_byte_size is null or p_byte_size < 1 or p_byte_size > 52428800 then
    raise exception 'library_epub_size_invalid';
  end if;

  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'library_epub_sha256_invalid';
  end if;

  select a.submission_status, p.status
    into v_submission_status, v_publication_status
    from public.library_author_publications a
    join public.library_publications p
      on p.id = a.publication_id
   where a.publication_id = p_publication_id
     and a.user_id = v_user_id
   for update of a, p;

  if v_submission_status is null then
    raise exception 'library_epub_publication_not_owned';
  end if;

  if v_submission_status not in ('draft', 'changes_requested') then
    raise exception 'library_epub_publication_not_editable';
  end if;

  if v_publication_status <> 'draft' then
    raise exception 'library_epub_canonical_publication_not_editable';
  end if;

  select s.id
    into v_source_id
    from public.library_publication_sources s
   where s.publication_id = p_publication_id
   for update;

  if v_source_id is null then
    v_source_id := gen_random_uuid();
  end if;

  v_storage_path := p_publication_id::text || '/' || v_source_id::text || '/original.epub';

  -- A replacement upload invalidates any previously normalized draft sections. They are
  -- rebuilt only after the newly uploaded original passes controlled ingestion.
  delete from public.library_publication_sections
   where publication_id = p_publication_id;

  insert into public.library_publication_sources (
    id,
    publication_id,
    storage_provider,
    storage_bucket,
    storage_path,
    media_type,
    byte_size,
    sha256,
    ingestion_status,
    ingestion_error,
    manifest_version,
    updated_at
  ) values (
    v_source_id,
    p_publication_id,
    'supabase',
    'library-publication-originals',
    v_storage_path,
    'application/epub+zip',
    p_byte_size,
    p_sha256,
    'pending',
    null,
    1,
    now()
  )
  on conflict (publication_id) do update
    set storage_provider = excluded.storage_provider,
        storage_bucket = excluded.storage_bucket,
        storage_path = excluded.storage_path,
        media_type = excluded.media_type,
        byte_size = excluded.byte_size,
        sha256 = excluded.sha256,
        ingestion_status = 'pending',
        ingestion_error = null,
        manifest_version = excluded.manifest_version,
        updated_at = now();

  source_id := v_source_id;
  storage_bucket := 'library-publication-originals';
  storage_path := v_storage_path;
  return next;
end;
$$;

revoke all on function public.prepare_library_author_epub_source(uuid, bigint, text) from public;
grant execute on function public.prepare_library_author_epub_source(uuid, bigint, text) to authenticated;

-- The bucket remains private. Authenticated access is scoped to an exact prepared path.
-- INSERT/UPDATE are only possible while the author's publication is editable. SELECT is
-- allowed only for the same owner while the canonical publication remains draft so a
-- request-scoped ingestion process can read the just-uploaded original with the user's JWT.
drop policy if exists "authors upload own library publication originals" on storage.objects;
create policy "authors upload own library publication originals"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'library-publication-originals'
    and public.library_current_user_can_access_original(name, true)
  );

drop policy if exists "authors update own library publication originals" on storage.objects;
create policy "authors update own library publication originals"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'library-publication-originals'
    and public.library_current_user_can_access_original(name, true)
  )
  with check (
    bucket_id = 'library-publication-originals'
    and public.library_current_user_can_access_original(name, true)
  );

drop policy if exists "authors read own draft library publication originals" on storage.objects;
create policy "authors read own draft library publication originals"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'library-publication-originals'
    and public.library_current_user_can_access_original(name, false)
  );

comment on function public.prepare_library_author_epub_source(uuid, bigint, text) is
  'Prepares or resets the single private EPUB source for an authenticated owner-managed draft. It never publishes content or grants broad Storage access.';
comment on function public.library_current_user_can_access_original(text, boolean) is
  'Checks exact-path private Library original access for the authenticated publication owner. Write access is limited to editable author states.';
