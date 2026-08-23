-- Loombus Library authenticated author EPUB ingestion runtime.
--
-- Keeps the author's JWT as the database/Storage identity while requiring a separate
-- server-only route capability before normalized sections can be mutated. This avoids
-- a Supabase service-role client while preventing browsers from bypassing the EPUB parser.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.library_ingestion_route_token_valid(p_token text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select p_token is not null
    and encode(digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
      = '92d86b03bc6c4b99e542a151e3d81d1d983c85905eb66bf55b5d2e5fc4af7f92';
$$;

revoke all on function public.library_ingestion_route_token_valid(text) from public;

create or replace function public.begin_library_author_epub_ingestion(
  p_source_id uuid,
  p_route_token text
)
returns table (
  publication_id uuid,
  storage_bucket text,
  storage_path text,
  byte_size bigint,
  sha256 text
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission_status text;
  v_publication_status text;
  v_ingestion_status text;
  v_publication_id uuid;
  v_storage_bucket text;
  v_storage_path text;
  v_byte_size bigint;
  v_sha256 text;
begin
  if v_user_id is null then
    raise exception 'library_epub_ingestion_auth_required';
  end if;

  if not public.library_ingestion_route_token_valid(p_route_token) then
    raise exception 'library_epub_ingestion_route_required';
  end if;

  select s.publication_id,
         s.storage_bucket,
         s.storage_path,
         s.byte_size,
         s.sha256,
         s.ingestion_status,
         a.submission_status,
         p.status
    into v_publication_id,
         v_storage_bucket,
         v_storage_path,
         v_byte_size,
         v_sha256,
         v_ingestion_status,
         v_submission_status,
         v_publication_status
    from public.library_publication_sources s
    join public.library_author_publications a
      on a.publication_id = s.publication_id
    join public.library_publications p
      on p.id = s.publication_id
   where s.id = p_source_id
     and a.user_id = v_user_id
   for update of s, a, p;

  if v_publication_id is null then
    raise exception 'library_epub_ingestion_source_not_owned';
  end if;

  if v_submission_status not in ('draft', 'changes_requested')
     or v_publication_status <> 'draft' then
    raise exception 'library_epub_ingestion_publication_not_editable';
  end if;

  if v_ingestion_status <> 'pending' then
    raise exception 'library_epub_ingestion_source_not_pending';
  end if;

  if v_storage_bucket <> 'library-publication-originals'
     or v_storage_path is null
     or v_byte_size < 1
     or v_byte_size > 52428800
     or v_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'library_epub_ingestion_source_invalid';
  end if;

  update public.library_publication_sources
     set ingestion_status = 'processing',
         ingestion_error = null,
         updated_at = now()
   where id = p_source_id;

  publication_id := v_publication_id;
  storage_bucket := v_storage_bucket;
  storage_path := v_storage_path;
  byte_size := v_byte_size;
  sha256 := v_sha256;
  return next;
end;
$$;

create or replace function public.complete_library_author_epub_ingestion(
  p_source_id uuid,
  p_route_token text,
  p_sections jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_publication_id uuid;
  v_submission_status text;
  v_publication_status text;
  v_ingestion_status text;
  v_count integer;
  v_distinct_keys integer;
  v_distinct_ordinals integer;
  v_min_ordinal integer;
  v_max_ordinal integer;
begin
  if v_user_id is null then
    raise exception 'library_epub_ingestion_auth_required';
  end if;

  if not public.library_ingestion_route_token_valid(p_route_token) then
    raise exception 'library_epub_ingestion_route_required';
  end if;

  if p_sections is null
     or jsonb_typeof(p_sections) <> 'array'
     or jsonb_array_length(p_sections) < 1
     or jsonb_array_length(p_sections) > 5000 then
    raise exception 'library_epub_ingestion_sections_invalid';
  end if;

  select s.publication_id,
         s.ingestion_status,
         a.submission_status,
         p.status
    into v_publication_id,
         v_ingestion_status,
         v_submission_status,
         v_publication_status
    from public.library_publication_sources s
    join public.library_author_publications a
      on a.publication_id = s.publication_id
    join public.library_publications p
      on p.id = s.publication_id
   where s.id = p_source_id
     and a.user_id = v_user_id
   for update of s, a, p;

  if v_publication_id is null then
    raise exception 'library_epub_ingestion_source_not_owned';
  end if;

  if v_ingestion_status <> 'processing' then
    raise exception 'library_epub_ingestion_source_not_processing';
  end if;

  if v_submission_status not in ('draft', 'changes_requested')
     or v_publication_status <> 'draft' then
    raise exception 'library_epub_ingestion_publication_not_editable';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_sections) as section_row(
        section_key text,
        ordinal integer,
        title text,
        content_html text,
        content_text text,
        content_sha256 text
      )
     where section_key is null
        or char_length(section_key) < 1
        or char_length(section_key) > 255
        or ordinal is null
        or ordinal < 0
        or (title is not null and char_length(title) > 1000)
        or content_html is null
        or char_length(content_html) < 1
        or content_text is null
        or char_length(btrim(content_text)) < 1
        or content_sha256 is null
        or content_sha256 !~ '^[0-9a-f]{64}$'
        or content_sha256 <> encode(
          digest(convert_to(content_html || E'\n' || content_text, 'UTF8'), 'sha256'),
          'hex'
        )
  ) then
    raise exception 'library_epub_ingestion_section_contract_invalid';
  end if;

  select count(*)::integer,
         count(distinct section_key)::integer,
         count(distinct ordinal)::integer,
         min(ordinal),
         max(ordinal)
    into v_count,
         v_distinct_keys,
         v_distinct_ordinals,
         v_min_ordinal,
         v_max_ordinal
    from jsonb_to_recordset(p_sections) as section_row(
      section_key text,
      ordinal integer,
      title text,
      content_html text,
      content_text text,
      content_sha256 text
    );

  if v_count <> jsonb_array_length(p_sections)
     or v_distinct_keys <> v_count
     or v_distinct_ordinals <> v_count
     or v_min_ordinal <> 0
     or v_max_ordinal <> v_count - 1 then
    raise exception 'library_epub_ingestion_section_order_invalid';
  end if;

  delete from public.library_publication_sections
   where publication_id = v_publication_id;

  insert into public.library_publication_sections (
    publication_id,
    source_id,
    section_key,
    ordinal,
    title,
    content_html,
    content_text,
    content_sha256
  )
  select v_publication_id,
         p_source_id,
         section_key,
         ordinal,
         title,
         content_html,
         content_text,
         content_sha256
    from jsonb_to_recordset(p_sections) as section_row(
      section_key text,
      ordinal integer,
      title text,
      content_html text,
      content_text text,
      content_sha256 text
    )
   order by ordinal;

  update public.library_publication_sources
     set ingestion_status = 'ready',
         ingestion_error = null,
         updated_at = now()
   where id = p_source_id
     and ingestion_status = 'processing';

  if not found then
    raise exception 'library_epub_ingestion_source_transition_failed';
  end if;

  return v_count;
end;
$$;

create or replace function public.fail_library_author_epub_ingestion(
  p_source_id uuid,
  p_route_token text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'library_epub_ingestion_auth_required';
  end if;

  if not public.library_ingestion_route_token_valid(p_route_token) then
    raise exception 'library_epub_ingestion_route_required';
  end if;

  update public.library_publication_sources s
     set ingestion_status = 'failed',
         ingestion_error = left(coalesce(nullif(btrim(p_error), ''), 'library_epub_ingestion_failed'), 1000),
         updated_at = now()
   where s.id = p_source_id
     and s.ingestion_status in ('pending', 'processing')
     and exists (
       select 1
         from public.library_author_publications a
         join public.library_publications p
           on p.id = a.publication_id
        where a.publication_id = s.publication_id
          and a.user_id = v_user_id
          and a.submission_status in ('draft', 'changes_requested')
          and p.status = 'draft'
     );
end;
$$;

revoke all on function public.begin_library_author_epub_ingestion(uuid, text) from public;
revoke all on function public.complete_library_author_epub_ingestion(uuid, text, jsonb) from public;
revoke all on function public.fail_library_author_epub_ingestion(uuid, text, text) from public;
grant execute on function public.begin_library_author_epub_ingestion(uuid, text) to authenticated;
grant execute on function public.complete_library_author_epub_ingestion(uuid, text, jsonb) to authenticated;
grant execute on function public.fail_library_author_epub_ingestion(uuid, text, text) to authenticated;

-- A publication cannot enter review without successfully normalized readable content.
create or replace function public.submit_library_author_publication(
  p_publication_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission_status text;
begin
  if v_user_id is null then
    raise exception 'library_author_auth_required';
  end if;

  select submission_status
    into v_submission_status
    from public.library_author_publications
   where publication_id = p_publication_id
     and user_id = v_user_id
   for update;

  if v_submission_status is null then
    raise exception 'library_author_publication_not_owned';
  end if;

  if v_submission_status not in ('draft', 'changes_requested') then
    raise exception 'library_author_publication_not_submittable';
  end if;

  if not exists (
    select 1
      from public.library_publications
     where id = p_publication_id
       and status = 'draft'
       and char_length(btrim(title)) > 0
  ) then
    raise exception 'library_author_canonical_publication_not_submittable';
  end if;

  if not exists (
    select 1
      from public.library_publication_sources s
     where s.publication_id = p_publication_id
       and s.ingestion_status = 'ready'
       and exists (
         select 1
           from public.library_publication_sections section_row
          where section_row.publication_id = p_publication_id
            and section_row.source_id = s.id
       )
  ) then
    raise exception 'library_author_readable_content_required';
  end if;

  update public.library_author_publications
     set submission_status = 'submitted',
         submitted_at = now(),
         reviewed_at = null,
         review_note = null,
         updated_at = now()
   where publication_id = p_publication_id
     and user_id = v_user_id;
end;
$$;

revoke all on function public.submit_library_author_publication(uuid) from public;
grant execute on function public.submit_library_author_publication(uuid) to authenticated;

-- Admin publication is independently fail-closed on readable normalized content.
create or replace function public.publish_library_author_publication(
  p_publication_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_status text;
begin
  if v_admin_id is null then
    raise exception 'library_publish_auth_required';
  end if;

  if not public.library_current_user_is_admin() then
    raise exception 'library_publish_admin_required';
  end if;

  select submission_status
    into v_status
    from public.library_author_publications
   where publication_id = p_publication_id
   for update;

  if v_status is null then
    raise exception 'library_publish_publication_not_found';
  end if;

  if v_status <> 'approved' then
    raise exception 'library_publish_publication_not_approved';
  end if;

  if not exists (
    select 1
      from public.library_publication_sources s
     where s.publication_id = p_publication_id
       and s.ingestion_status = 'ready'
       and exists (
         select 1
           from public.library_publication_sections section_row
          where section_row.publication_id = p_publication_id
            and section_row.source_id = s.id
       )
  ) then
    raise exception 'library_publish_readable_content_required';
  end if;

  update public.library_publications
     set status = 'published',
         publication_date = coalesce(publication_date, current_date),
         updated_at = now()
   where id = p_publication_id
     and status = 'draft';

  if not found then
    raise exception 'library_publish_canonical_publication_not_publishable';
  end if;

  update public.library_author_publications
     set published_at = now(),
         published_by = v_admin_id,
         updated_at = now()
   where publication_id = p_publication_id;
end;
$$;

revoke all on function public.publish_library_author_publication(uuid) from public;
grant execute on function public.publish_library_author_publication(uuid) to authenticated;

comment on function public.begin_library_author_epub_ingestion(uuid, text) is
  'Server-route-capability-gated transition that begins parser-controlled EPUB ingestion using the authenticated author identity.';
comment on function public.complete_library_author_epub_ingestion(uuid, text, jsonb) is
  'Server-route-capability-gated replacement of normalized sections after the authenticated author EPUB has been parsed and validated.';
comment on function public.fail_library_author_epub_ingestion(uuid, text, text) is
  'Server-route-capability-gated failure transition for an authenticated author EPUB ingestion attempt.';
comment on function public.submit_library_author_publication(uuid) is
  'Moves an authenticated author-owned draft into review only after readable normalized content is ready.';
comment on function public.publish_library_author_publication(uuid) is
  'Admin-only publication transition that additionally requires ready normalized readable content.';
