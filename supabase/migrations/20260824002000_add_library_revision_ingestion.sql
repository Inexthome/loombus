-- Version-aware Library EPUB source preparation and parser-controlled ingestion.

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
    join public.library_publications p on p.id = s.publication_id
    left join public.library_author_publications a
      on a.publication_id = s.publication_id and a.user_id = auth.uid()
    left join public.library_publication_revision_reviews r
      on r.version_id = s.version_id and r.publication_id = s.publication_id and r.user_id = auth.uid()
    where s.storage_provider = 'supabase'
      and s.storage_bucket = 'library-publication-originals'
      and s.storage_path = p_storage_path
      and (
        (
          a.user_id = auth.uid()
          and p.status = 'draft'
          and s.version_id = p.active_version_id
          and (p_write is false or a.submission_status in ('draft','changes_requested'))
        )
        or
        (
          r.user_id = auth.uid()
          and p.status = 'published'
          and s.version_id <> p.active_version_id
          and exists (
            select 1 from public.library_publication_versions v
            where v.id = s.version_id
              and v.publication_id = s.publication_id
              and v.version_status = 'draft'
          )
          and (p_write is false or r.submission_status in ('draft','changes_requested'))
        )
      )
  );
$$;

revoke all on function public.library_current_user_can_access_original(text,boolean) from public;
grant execute on function public.library_current_user_can_access_original(text,boolean) to authenticated;

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

  select a.submission_status, p.status, p.active_version_id
    into v_submission_status, v_publication_status, v_version_id
    from public.library_author_publications a
    join public.library_publications p on p.id = a.publication_id
   where a.publication_id = p_publication_id and a.user_id = v_user_id
   for update of a, p;

  if v_submission_status is null then raise exception 'library_epub_publication_not_owned'; end if;
  if v_submission_status not in ('draft','changes_requested') then raise exception 'library_epub_publication_not_editable'; end if;
  if v_publication_status <> 'draft' then raise exception 'library_epub_canonical_publication_not_editable'; end if;
  if v_version_id is null then raise exception 'library_epub_version_required'; end if;

  select id into v_source_id from public.library_publication_sources where version_id = v_version_id for update;
  if v_source_id is null then v_source_id := gen_random_uuid(); end if;
  v_storage_path := p_publication_id::text || '/' || v_version_id::text || '/' || v_source_id::text || '/original.epub';

  delete from public.library_publication_sections where version_id = v_version_id;
  insert into public.library_publication_sources (
    id, publication_id, version_id, storage_provider, storage_bucket, storage_path,
    media_type, byte_size, sha256, ingestion_status, ingestion_error, manifest_version, updated_at
  ) values (
    v_source_id, p_publication_id, v_version_id, 'supabase', 'library-publication-originals', v_storage_path,
    'application/epub+zip', p_byte_size, p_sha256, 'pending', null, 1, now()
  )
  on conflict (version_id) do update
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

create or replace function public.prepare_library_author_revision_epub_source(
  p_version_id uuid,
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
  v_publication_id uuid;
  v_status text;
  v_source_id uuid;
  v_storage_path text;
begin
  if v_user_id is null then raise exception 'library_revision_epub_auth_required'; end if;
  if p_byte_size is null or p_byte_size < 1 or p_byte_size > 52428800 then raise exception 'library_epub_size_invalid'; end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'library_epub_sha256_invalid'; end if;

  select r.publication_id, r.submission_status
    into v_publication_id, v_status
    from public.library_publication_revision_reviews r
    join public.library_publications p on p.id = r.publication_id
    join public.library_publication_versions v on v.id = r.version_id and v.publication_id = r.publication_id
   where r.version_id = p_version_id
     and r.user_id = v_user_id
     and p.status = 'published'
     and p.active_version_id <> r.version_id
     and v.version_status = 'draft'
   for update of r, v;
  if v_publication_id is null then raise exception 'library_revision_epub_not_owned'; end if;
  if v_status not in ('draft','changes_requested') then raise exception 'library_revision_epub_not_editable'; end if;

  select id into v_source_id from public.library_publication_sources where version_id = p_version_id for update;
  if v_source_id is null then v_source_id := gen_random_uuid(); end if;
  v_storage_path := v_publication_id::text || '/' || p_version_id::text || '/' || v_source_id::text || '/original.epub';

  delete from public.library_publication_sections where version_id = p_version_id;
  insert into public.library_publication_sources (
    id, publication_id, version_id, storage_provider, storage_bucket, storage_path,
    media_type, byte_size, sha256, ingestion_status, ingestion_error, manifest_version, updated_at
  ) values (
    v_source_id, v_publication_id, p_version_id, 'supabase', 'library-publication-originals', v_storage_path,
    'application/epub+zip', p_byte_size, p_sha256, 'pending', null, 1, now()
  )
  on conflict (version_id) do update
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

create or replace function public.begin_library_author_epub_ingestion(p_source_id uuid, p_route_token text)
returns table (publication_id uuid, storage_bucket text, storage_path text, byte_size bigint, sha256 text)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.library_publication_sources%rowtype;
  v_allowed boolean;
begin
  if v_user_id is null then raise exception 'library_epub_ingestion_auth_required'; end if;
  if not public.library_ingestion_route_token_valid(p_route_token) then raise exception 'library_epub_ingestion_route_required'; end if;
  select * into v_source from public.library_publication_sources where id = p_source_id for update;
  if v_source.id is null then raise exception 'library_epub_ingestion_source_not_found'; end if;

  select (
    exists (
      select 1 from public.library_author_publications a join public.library_publications p on p.id=a.publication_id
      where a.publication_id=v_source.publication_id and a.user_id=v_user_id
        and a.submission_status in ('draft','changes_requested') and p.status='draft' and p.active_version_id=v_source.version_id
    )
    or exists (
      select 1 from public.library_publication_revision_reviews r
      join public.library_publications p on p.id=r.publication_id
      join public.library_publication_versions v on v.id=r.version_id and v.publication_id=r.publication_id
      where r.version_id=v_source.version_id and r.publication_id=v_source.publication_id and r.user_id=v_user_id
        and r.submission_status in ('draft','changes_requested') and p.status='published'
        and p.active_version_id<>r.version_id and v.version_status='draft'
    )
  ) into v_allowed;
  if not v_allowed then raise exception 'library_epub_ingestion_source_not_owned'; end if;
  if v_source.ingestion_status <> 'pending' then raise exception 'library_epub_ingestion_source_not_pending'; end if;
  if v_source.storage_bucket <> 'library-publication-originals' or v_source.storage_path is null
     or v_source.byte_size < 1 or v_source.byte_size > 52428800 or v_source.sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'library_epub_ingestion_source_invalid';
  end if;

  update public.library_publication_sources set ingestion_status='processing', ingestion_error=null, updated_at=now() where id=p_source_id;
  publication_id := v_source.publication_id;
  storage_bucket := v_source.storage_bucket;
  storage_path := v_source.storage_path;
  byte_size := v_source.byte_size;
  sha256 := v_source.sha256;
  return next;
end;
$$;

create or replace function public.complete_library_author_epub_ingestion(p_source_id uuid, p_route_token text, p_sections jsonb)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.library_publication_sources%rowtype;
  v_allowed boolean;
  v_count integer;
  v_distinct_keys integer;
  v_distinct_ordinals integer;
  v_min_ordinal integer;
  v_max_ordinal integer;
begin
  if v_user_id is null then raise exception 'library_epub_ingestion_auth_required'; end if;
  if not public.library_ingestion_route_token_valid(p_route_token) then raise exception 'library_epub_ingestion_route_required'; end if;
  if p_sections is null or jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) < 1 or jsonb_array_length(p_sections) > 5000 then raise exception 'library_epub_ingestion_sections_invalid'; end if;

  select * into v_source from public.library_publication_sources where id=p_source_id for update;
  if v_source.id is null or v_source.ingestion_status <> 'processing' then raise exception 'library_epub_ingestion_source_not_processing'; end if;

  select (
    exists (
      select 1 from public.library_author_publications a join public.library_publications p on p.id=a.publication_id
      where a.publication_id=v_source.publication_id and a.user_id=v_user_id
        and a.submission_status in ('draft','changes_requested') and p.status='draft' and p.active_version_id=v_source.version_id
    )
    or exists (
      select 1 from public.library_publication_revision_reviews r
      join public.library_publications p on p.id=r.publication_id
      join public.library_publication_versions v on v.id=r.version_id and v.publication_id=r.publication_id
      where r.version_id=v_source.version_id and r.publication_id=v_source.publication_id and r.user_id=v_user_id
        and r.submission_status in ('draft','changes_requested') and p.status='published'
        and p.active_version_id<>r.version_id and v.version_status='draft'
    )
  ) into v_allowed;
  if not v_allowed then raise exception 'library_epub_ingestion_source_not_owned'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_sections) as x(section_key text, ordinal integer, title text, content_html text, content_text text, content_sha256 text)
    where section_key is null or char_length(section_key)<1 or char_length(section_key)>255
       or ordinal is null or ordinal<0 or (title is not null and char_length(title)>1000)
       or content_html is null or char_length(content_html)<1
       or content_text is null or char_length(btrim(content_text))<1
       or content_sha256 is null or content_sha256 !~ '^[0-9a-f]{64}$'
       or content_sha256 <> encode(digest(convert_to(content_html || E'\n' || content_text,'UTF8'),'sha256'),'hex')
  ) then raise exception 'library_epub_ingestion_section_contract_invalid'; end if;

  select count(*)::integer, count(distinct section_key)::integer, count(distinct ordinal)::integer, min(ordinal), max(ordinal)
    into v_count, v_distinct_keys, v_distinct_ordinals, v_min_ordinal, v_max_ordinal
    from jsonb_to_recordset(p_sections) as x(section_key text, ordinal integer, title text, content_html text, content_text text, content_sha256 text);
  if v_count<>jsonb_array_length(p_sections) or v_distinct_keys<>v_count or v_distinct_ordinals<>v_count or v_min_ordinal<>0 or v_max_ordinal<>v_count-1 then raise exception 'library_epub_ingestion_section_order_invalid'; end if;

  delete from public.library_publication_sections where version_id=v_source.version_id;
  insert into public.library_publication_sections(publication_id,version_id,source_id,section_key,ordinal,title,content_html,content_text,content_sha256)
  select v_source.publication_id,v_source.version_id,p_source_id,section_key,ordinal,title,content_html,content_text,content_sha256
    from jsonb_to_recordset(p_sections) as x(section_key text, ordinal integer, title text, content_html text, content_text text, content_sha256 text)
   order by ordinal;

  update public.library_publication_sources set ingestion_status='ready',ingestion_error=null,updated_at=now()
   where id=p_source_id and ingestion_status='processing';
  if not found then raise exception 'library_epub_ingestion_source_transition_failed'; end if;
  return v_count;
end;
$$;

create or replace function public.fail_library_author_epub_ingestion(p_source_id uuid,p_route_token text,p_error text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'library_epub_ingestion_auth_required'; end if;
  if not public.library_ingestion_route_token_valid(p_route_token) then raise exception 'library_epub_ingestion_route_required'; end if;
  update public.library_publication_sources s
     set ingestion_status='failed',ingestion_error=left(coalesce(nullif(btrim(p_error),''),'library_epub_ingestion_failed'),1000),updated_at=now()
   where s.id=p_source_id and s.ingestion_status in ('pending','processing')
     and (
       exists (
         select 1 from public.library_author_publications a join public.library_publications p on p.id=a.publication_id
         where a.publication_id=s.publication_id and a.user_id=v_user_id and a.submission_status in ('draft','changes_requested')
           and p.status='draft' and p.active_version_id=s.version_id
       )
       or exists (
         select 1 from public.library_publication_revision_reviews r
         join public.library_publications p on p.id=r.publication_id
         join public.library_publication_versions v on v.id=r.version_id and v.publication_id=r.publication_id
         where r.version_id=s.version_id and r.publication_id=s.publication_id and r.user_id=v_user_id
           and r.submission_status in ('draft','changes_requested') and p.status='published'
           and p.active_version_id<>r.version_id and v.version_status='draft'
       )
     );
end;
$$;

revoke all on function public.prepare_library_author_epub_source(uuid,bigint,text) from public;
revoke all on function public.prepare_library_author_revision_epub_source(uuid,bigint,text) from public;
revoke all on function public.begin_library_author_epub_ingestion(uuid,text) from public;
revoke all on function public.complete_library_author_epub_ingestion(uuid,text,jsonb) from public;
revoke all on function public.fail_library_author_epub_ingestion(uuid,text,text) from public;
grant execute on function public.prepare_library_author_epub_source(uuid,bigint,text) to authenticated;
grant execute on function public.prepare_library_author_revision_epub_source(uuid,bigint,text) to authenticated;
grant execute on function public.begin_library_author_epub_ingestion(uuid,text) to authenticated;
grant execute on function public.complete_library_author_epub_ingestion(uuid,text,jsonb) to authenticated;
grant execute on function public.fail_library_author_epub_ingestion(uuid,text,text) to authenticated;
