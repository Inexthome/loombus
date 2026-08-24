-- Preserve the established first-publication original path so replacement uploads do not orphan
-- pre-versioning private Storage objects. Revision originals remain version-qualified.

create or replace function public.prepare_library_author_epub_source(
  p_publication_id uuid,
  p_byte_size bigint,
  p_sha256 text
)
returns table (source_id uuid, storage_bucket text, storage_path text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission_status text;
  v_publication_status text;
  v_version_id uuid;
  v_source_id uuid;
  v_storage_path text;
begin
  if v_user_id is null then raise exception 'library_epub_auth_required'; end if;
  if p_byte_size is null or p_byte_size < 1 or p_byte_size > 52428800 then raise exception 'library_epub_size_invalid'; end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'library_epub_sha256_invalid'; end if;

  select a.submission_status,p.status,p.active_version_id
    into v_submission_status,v_publication_status,v_version_id
    from public.library_author_publications a
    join public.library_publications p on p.id=a.publication_id
   where a.publication_id=p_publication_id and a.user_id=v_user_id
   for update of a,p;

  if v_submission_status is null then raise exception 'library_epub_publication_not_owned'; end if;
  if v_submission_status not in ('draft','changes_requested') then raise exception 'library_epub_publication_not_editable'; end if;
  if v_publication_status <> 'draft' then raise exception 'library_epub_canonical_publication_not_editable'; end if;
  if v_version_id is null then raise exception 'library_epub_version_required'; end if;

  select id into v_source_id from public.library_publication_sources where version_id=v_version_id for update;
  if v_source_id is null then v_source_id := gen_random_uuid(); end if;
  v_storage_path := p_publication_id::text || '/' || v_source_id::text || '/original.epub';

  delete from public.library_publication_sections where version_id=v_version_id;
  insert into public.library_publication_sources(
    id,publication_id,version_id,storage_provider,storage_bucket,storage_path,
    media_type,byte_size,sha256,ingestion_status,ingestion_error,manifest_version,updated_at
  ) values (
    v_source_id,p_publication_id,v_version_id,'supabase','library-publication-originals',v_storage_path,
    'application/epub+zip',p_byte_size,p_sha256,'pending',null,1,now()
  )
  on conflict (version_id) do update
    set storage_provider=excluded.storage_provider,
        storage_bucket=excluded.storage_bucket,
        storage_path=excluded.storage_path,
        media_type=excluded.media_type,
        byte_size=excluded.byte_size,
        sha256=excluded.sha256,
        ingestion_status='pending',
        ingestion_error=null,
        manifest_version=excluded.manifest_version,
        updated_at=now();

  source_id:=v_source_id;
  storage_bucket:='library-publication-originals';
  storage_path:=v_storage_path;
  return next;
end;
$$;

revoke all on function public.prepare_library_author_epub_source(uuid,bigint,text) from public;
grant execute on function public.prepare_library_author_epub_source(uuid,bigint,text) to authenticated;
