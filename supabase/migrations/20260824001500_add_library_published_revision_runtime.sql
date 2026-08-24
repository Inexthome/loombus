-- Loombus Library controlled published-revision runtime.
--
-- Builds on the immutable publication-version foundation. A revision is staged against
-- its own version/source/normalized sections while the current active version remains live.
-- Admin publication atomically supersedes the old active version and promotes the approved
-- revision. No service-role access or public original-EPUB access is introduced.

-- One source and one ordered normalized section set per publication VERSION, rather than
-- per canonical publication. This is the deliberate constraint transition deferred by #1027.
alter table public.library_publication_sources
  drop constraint if exists library_publication_sources_publication_id_key;
alter table public.library_publication_sources
  add constraint library_publication_sources_version_id_key unique (version_id);

alter table public.library_publication_sections
  drop constraint if exists library_publication_sections_publication_id_section_key_key;
alter table public.library_publication_sections
  drop constraint if exists library_publication_sections_publication_id_ordinal_key;
alter table public.library_publication_sections
  add constraint library_publication_sections_version_section_key_key unique (version_id, section_key);
alter table public.library_publication_sections
  add constraint library_publication_sections_version_ordinal_key unique (version_id, ordinal);

-- A distinct editorial row is required for each published-work revision. The historical
-- first-publication review row remains in library_author_publications.
create table if not exists public.library_publication_revision_reviews (
  version_id uuid primary key references public.library_publication_versions(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_status text not null default 'draft'
    check (submission_status in ('draft','submitted','changes_requested','approved','rejected')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_revision_review_version_publication_fkey
    foreign key (version_id, publication_id)
    references public.library_publication_versions(id, publication_id)
    on delete cascade,
  constraint library_revision_review_note_check
    check (review_note is null or char_length(review_note) <= 2000)
);

create index if not exists library_revision_reviews_author_updated_idx
  on public.library_publication_revision_reviews(user_id, updated_at desc);
create index if not exists library_revision_reviews_status_submitted_idx
  on public.library_publication_revision_reviews(submission_status, submitted_at);
create unique index if not exists library_revision_reviews_one_open_per_publication_idx
  on public.library_publication_revision_reviews(publication_id)
  where submission_status in ('draft','submitted','changes_requested','approved');

alter table public.library_publication_revision_reviews enable row level security;

-- Version ledger visibility remains private to the publication owner/editorial admins.
grant select on public.library_publication_versions to authenticated;
drop policy if exists "authors read own library publication versions" on public.library_publication_versions;
create policy "authors read own library publication versions"
  on public.library_publication_versions for select to authenticated
  using (
    exists (
      select 1 from public.library_author_publications a
      where a.publication_id = library_publication_versions.publication_id
        and a.user_id = auth.uid()
        and a.retired_at is null
    )
  );
drop policy if exists "admins read library publication versions" on public.library_publication_versions;
create policy "admins read library publication versions"
  on public.library_publication_versions for select to authenticated
  using (public.library_current_user_is_admin());

revoke all on table public.library_publication_revision_reviews from anon;
revoke all on table public.library_publication_revision_reviews from authenticated;
grant select on table public.library_publication_revision_reviews to authenticated;

drop policy if exists "authors read own library revision reviews" on public.library_publication_revision_reviews;
create policy "authors read own library revision reviews"
  on public.library_publication_revision_reviews for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "admins read library revision reviews" on public.library_publication_revision_reviews;
create policy "admins read library revision reviews"
  on public.library_publication_revision_reviews for select to authenticated
  using (public.library_current_user_is_admin());

-- Draft normalized revision content is visible only to its author and admins. Published
-- normalized content continues through the existing active-version published policy.
drop policy if exists "authors read own normalized revision sections" on public.library_publication_sections;
create policy "authors read own normalized revision sections"
  on public.library_publication_sections for select to authenticated
  using (
    exists (
      select 1 from public.library_publication_revision_reviews r
      where r.version_id = library_publication_sections.version_id
        and r.publication_id = library_publication_sections.publication_id
        and r.user_id = auth.uid()
        and r.submission_status in ('draft','submitted','changes_requested','approved','rejected')
    )
  );

-- Exact-path original access supports either an editable first-publication draft or an
-- editable staged revision. Canonical published originals remain inaccessible to authors.
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
      on a.publication_id = s.publication_id
     and a.user_id = auth.uid()
    left join public.library_publication_revision_reviews r
      on r.version_id = s.version_id
     and r.publication_id = s.publication_id
     and r.user_id = auth.uid()
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

revoke all on function public.library_current_user_can_access_original(text, boolean) from public;
grant execute on function public.library_current_user_can_access_original(text, boolean) to authenticated;

-- Keep first-publication source preparation working after source uniqueness becomes version-scoped.
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
   where a.publication_id = p_publication_id
     and a.user_id = v_user_id
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

revoke all on function public.prepare_library_author_epub_source(uuid, bigint, text) from public;
grant execute on function public.prepare_library_author_epub_source(uuid, bigint, text) to authenticated;

-- Start one revision by snapshotting the active published metadata. The live version remains
-- untouched and readable until an admin later publishes the approved revision.
create or replace function public.create_library_author_revision(p_publication_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_active_version_id uuid;
  v_next_number integer;
  v_version_id uuid := gen_random_uuid();
  v_active public.library_publication_versions%rowtype;
begin
  if v_user_id is null then raise exception 'library_revision_auth_required'; end if;

  select p.active_version_id
    into v_active_version_id
    from public.library_publications p
    join public.library_author_publications a on a.publication_id = p.id
   where p.id = p_publication_id
     and p.status = 'published'
     and a.user_id = v_user_id
     and a.retired_at is null
   for update of p, a;
  if v_active_version_id is null then raise exception 'library_revision_published_publication_not_owned'; end if;

  if exists (
    select 1 from public.library_publication_revision_reviews r
    where r.publication_id = p_publication_id
      and r.submission_status in ('draft','submitted','changes_requested','approved')
  ) then raise exception 'library_revision_already_open'; end if;

  select * into v_active from public.library_publication_versions
   where id = v_active_version_id and publication_id = p_publication_id and version_status = 'published'
   for share;
  if v_active.id is null then raise exception 'library_revision_active_version_invalid'; end if;

  select coalesce(max(version_number),0) + 1 into v_next_number
    from public.library_publication_versions where publication_id = p_publication_id;

  insert into public.library_publication_versions (
    id, publication_id, version_number, version_status, title, subtitle, description,
    publication_type, author_name, publisher_name, language_code, cover_url, isbn,
    publication_date, is_free
  ) values (
    v_version_id, p_publication_id, v_next_number, 'draft', v_active.title, v_active.subtitle,
    v_active.description, v_active.publication_type, v_active.author_name, v_active.publisher_name,
    v_active.language_code, v_active.cover_url, v_active.isbn, v_active.publication_date, v_active.is_free
  );

  insert into public.library_publication_revision_reviews(version_id, publication_id, user_id)
  values (v_version_id, p_publication_id, v_user_id);

  return v_version_id;
end;
$$;

create or replace function public.update_library_author_revision(
  p_version_id uuid,
  p_title text,
  p_author_name text default null,
  p_publication_type text default 'book',
  p_subtitle text default null,
  p_description text default null,
  p_publisher_name text default null,
  p_language_code text default 'en',
  p_isbn text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_publication_id uuid;
begin
  if v_user_id is null then raise exception 'library_revision_auth_required'; end if;
  if p_title is null or char_length(btrim(p_title)) = 0 or char_length(btrim(p_title)) > 200 then raise exception 'library_revision_title_invalid'; end if;
  if p_publication_type not in ('book','essay','research','report','guide','article','other') then raise exception 'library_revision_publication_type_invalid'; end if;
  if p_language_code is null or char_length(btrim(p_language_code)) not between 2 and 12 then raise exception 'library_revision_language_invalid'; end if;

  select r.submission_status, r.publication_id into v_status, v_publication_id
    from public.library_publication_revision_reviews r
    join public.library_publications p on p.id = r.publication_id
    join public.library_publication_versions v on v.id = r.version_id and v.publication_id = r.publication_id
   where r.version_id = p_version_id
     and r.user_id = v_user_id
     and p.status = 'published'
     and p.active_version_id <> r.version_id
     and v.version_status = 'draft'
   for update of r, v;

  if v_status is null then raise exception 'library_revision_not_owned_or_editable'; end if;
  if v_status not in ('draft','changes_requested') then raise exception 'library_revision_not_editable'; end if;

  update public.library_publication_versions
     set title = btrim(p_title),
         subtitle = nullif(btrim(coalesce(p_subtitle,'')),''),
         description = nullif(btrim(coalesce(p_description,'')),''),
         publication_type = p_publication_type,
         author_name = nullif(btrim(coalesce(p_author_name,'')),''),
         publisher_name = nullif(btrim(coalesce(p_publisher_name,'')),''),
         language_code = btrim(p_language_code),
         isbn = nullif(btrim(coalesce(p_isbn,'')),'')
   where id = p_version_id and publication_id = v_publication_id and version_status = 'draft';

  update public.library_publication_revision_reviews set updated_at = now() where version_id = p_version_id;
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

  select r.publication_id, r.submission_status into v_publication_id, v_status
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

-- The parser route continues to accept sourceId only. These replacements authorize either
-- an editable initial draft or an editable staged revision and mutate only that source version.
create or replace function public.begin_library_author_epub_ingestion(p_source_id uuid, p_route_token text)
returns table (publication_id uuid, storage_bucket text, storage_path text, byte_size bigint, sha256 text)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.library_publication_sources%rowtype;
  v_initial_editable boolean := false;
  v_revision_editable boolean := false;
begin
  if v_user_id is null then raise exception 'library_epub_ingestion_auth_required'; end if;
  if not public.library_ingestion_route_token_valid(p_route_token) then raise exception 'library_epub_ingestion_route_required'; end if;

  select * into v_source from public.library_publication_sources where id = p_source_id for update;
  if v_source.id is null then raise exception 'library_epub_ingestion_source_not_found'; end if;

  select exists (
    select 1 from public.library_author_publications a
    join public.library_publications p on p.id = a.publication_id
    where a.publication_id = v_source.publication_id and a.user_id = v_user_id
      and a.submission_status in ('draft','changes_requested') and p.status = 'draft'
      and p.active_version_id = v_source.version_id
  ) into v_initial_editable;

  select exists (
    select 1 from public.library_publication_revision_reviews r
    join public.library_publications p on p.id = r.publication_id
    join public.library_publication_versions v on v.id = r.version_id and v.publication_id = r.publication_id
    where r.version_id = v_source.version_id and r.publication_id = v_source.publication_id
      and r.user_id = v_user_id and r.submission_status in ('draft','changes_requested')
      and p.status = 'published' and p.active_version_id <> r.version_id and v.version_status = 'draft'
  ) into v_revision_editable;

  if not (v_initial_editable or v_revision_editable) then raise exception 'library_epub_ingestion_source_not_owned'; end if;
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

create or replace function public.complete_library_author_epub_ingestion(
  p_source_id uuid, p_route_token text, p_sections jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.library_publication_sources%rowtype;
  v_allowed boolean := false;
  v_count integer;
  v_distinct_keys integer;
  v_distinct_ordinals integer;
  v_min_ordinal integer;
  v_max_ordinal integer;
begin
  if v_user_id is null then raise exception 'library_epub_ingestion_auth_required'; end if;
  if not public.library_ingestion_route_token_valid(p_route_token) then raise exception 'library_epub_ingestion_route_required'; end if;
  if p_sections is null or jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) < 1 or jsonb_array_length(p_sections) > 5000 then
    raise exception 'library_epub_ingestion_sections_invalid';
  end if;

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
      where r.version_id=v_source.version_id and r.publication_id=v_source.publication_id
        and r.user_id=v_user_id and r.submission_status in ('draft','changes_requested')
        and p.status='published' and p.active_version_id<>r.version_id and v.version_status='draft'
    )
  ) into v_allowed;
  if not v_allowed then raise exception 'library_epub_ingestion_source_not_owned'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_sections) as x(section_key text, ordinal integer, title text, content_html text, content_text text, content_sha256 text)
    where section_key is null or char_length(section_key) < 1 or char_length(section_key) > 255
       or ordinal is null or ordinal < 0 or (title is not null and char_length(title)>1000)
       or content_html is null or char_length(content_html)<1
       or content_text is null or char_length(btrim(content_text))<1
       or content_sha256 is null or content_sha256 !~ '^[0-9a-f]{64}$'
       or content_sha256 <> encode(digest(convert_to(content_html || E'\n' || content_text,'UTF8'),'sha256'),'hex')
  ) then raise exception 'library_epub_ingestion_section_contract_invalid'; end if;

  select count(*)::integer, count(distinct section_key)::integer, count(distinct ordinal)::integer, min(ordinal), max(ordinal)
    into v_count, v_distinct_keys, v_distinct_ordinals, v_min_ordinal, v_max_ordinal
    from jsonb_to_recordset(p_sections) as x(section_key text, ordinal integer, title text, content_html text, content_text text, content_sha256 text);
  if v_count<>jsonb_array_length(p_sections) or v_distinct_keys<>v_count or v_distinct_ordinals<>v_count or v_min_ordinal<>0 or v_max_ordinal<>v_count-1 then
    raise exception 'library_epub_ingestion_section_order_invalid';
  end if;

  delete from public.library_publication_sections where version_id=v_source.version_id;
  insert into public.library_publication_sections(
    publication_id, version_id, source_id, section_key, ordinal, title, content_html, content_text, content_sha256
  )
  select v_source.publication_id, v_source.version_id, p_source_id, section_key, ordinal, title, content_html, content_text, content_sha256
    from jsonb_to_recordset(p_sections) as x(section_key text, ordinal integer, title text, content_html text, content_text text, content_sha256 text)
   order by ordinal;

  update public.library_publication_sources set ingestion_status='ready', ingestion_error=null, updated_at=now()
   where id=p_source_id and ingestion_status='processing';
  if not found then raise exception 'library_epub_ingestion_source_transition_failed'; end if;
  return v_count;
end;
$$;

create or replace function public.fail_library_author_epub_ingestion(p_source_id uuid, p_route_token text, p_error text)
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
     set ingestion_status='failed', ingestion_error=left(coalesce(nullif(btrim(p_error),''),'library_epub_ingestion_failed'),1000), updated_at=now()
   where s.id=p_source_id
     and s.ingestion_status in ('pending','processing')
     and (
       exists (
         select 1 from public.library_author_publications a join public.library_publications p on p.id=a.publication_id
         where a.publication_id=s.publication_id and a.user_id=v_user_id
           and a.submission_status in ('draft','changes_requested') and p.status='draft' and p.active_version_id=s.version_id
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

revoke all on function public.begin_library_author_epub_ingestion(uuid,text) from public;
revoke all on function public.complete_library_author_epub_ingestion(uuid,text,jsonb) from public;
revoke all on function public.fail_library_author_epub_ingestion(uuid,text,text) from public;
grant execute on function public.begin_library_author_epub_ingestion(uuid,text) to authenticated;
grant execute on function public.complete_library_author_epub_ingestion(uuid,text,jsonb) to authenticated;
grant execute on function public.fail_library_author_epub_ingestion(uuid,text,text) to authenticated;

create or replace function public.submit_library_author_revision(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_publication_id uuid;
begin
  if v_user_id is null then raise exception 'library_revision_auth_required'; end if;
  select r.submission_status, r.publication_id into v_status, v_publication_id
    from public.library_publication_revision_reviews r
    join public.library_publications p on p.id=r.publication_id
    join public.library_publication_versions v on v.id=r.version_id and v.publication_id=r.publication_id
   where r.version_id=p_version_id and r.user_id=v_user_id
     and p.status='published' and p.active_version_id<>r.version_id and v.version_status='draft'
   for update of r, v;
  if v_status is null then raise exception 'library_revision_not_owned'; end if;
  if v_status not in ('draft','changes_requested') then raise exception 'library_revision_not_submittable'; end if;
  if not exists (
    select 1 from public.library_publication_sources s
    where s.version_id=p_version_id and s.publication_id=v_publication_id and s.ingestion_status='ready'
      and exists (select 1 from public.library_publication_sections x where x.version_id=p_version_id and x.source_id=s.id)
  ) then raise exception 'library_revision_readable_content_required'; end if;

  update public.library_publication_revision_reviews
     set submission_status='submitted', submitted_at=now(), reviewed_at=null, reviewed_by=null, review_note=null, updated_at=now()
   where version_id=p_version_id;
end;
$$;

create or replace function public.review_library_author_revision(
  p_version_id uuid, p_action text, p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_status text;
  v_note text := nullif(btrim(coalesce(p_review_note,'')),'');
begin
  if v_admin_id is null then raise exception 'library_revision_review_auth_required'; end if;
  if not public.library_current_user_is_admin() then raise exception 'library_revision_review_admin_required'; end if;
  if p_action not in ('request_changes','approve','reject') then raise exception 'library_revision_review_action_invalid'; end if;
  if p_action in ('request_changes','reject') and v_note is null then raise exception 'library_revision_review_note_required'; end if;
  if v_note is not null and char_length(v_note)>2000 then raise exception 'library_revision_review_note_too_long'; end if;

  select submission_status into v_status from public.library_publication_revision_reviews where version_id=p_version_id for update;
  if v_status is null then raise exception 'library_revision_review_not_found'; end if;
  if v_status<>'submitted' then raise exception 'library_revision_review_not_pending'; end if;

  update public.library_publication_revision_reviews
     set submission_status=case p_action when 'request_changes' then 'changes_requested' when 'approve' then 'approved' else 'rejected' end,
         reviewed_at=now(), reviewed_by=v_admin_id, review_note=v_note, updated_at=now()
   where version_id=p_version_id;
end;
$$;

create or replace function public.publish_library_author_revision(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_publication_id uuid;
  v_status text;
  v_old_version_id uuid;
  v_new public.library_publication_versions%rowtype;
begin
  if v_admin_id is null then raise exception 'library_revision_publish_auth_required'; end if;
  if not public.library_current_user_is_admin() then raise exception 'library_revision_publish_admin_required'; end if;

  select r.publication_id, r.submission_status, p.active_version_id
    into v_publication_id, v_status, v_old_version_id
    from public.library_publication_revision_reviews r
    join public.library_publications p on p.id=r.publication_id
   where r.version_id=p_version_id and p.status='published'
   for update of r, p;
  if v_publication_id is null then raise exception 'library_revision_publish_not_found'; end if;
  if v_status<>'approved' then raise exception 'library_revision_publish_not_approved'; end if;
  if v_old_version_id=p_version_id then raise exception 'library_revision_already_active'; end if;

  select * into v_new from public.library_publication_versions
   where id=p_version_id and publication_id=v_publication_id and version_status='draft' for update;
  if v_new.id is null then raise exception 'library_revision_publish_version_invalid'; end if;
  if not exists (
    select 1 from public.library_publication_sources s
    where s.version_id=p_version_id and s.publication_id=v_publication_id and s.ingestion_status='ready'
      and exists (select 1 from public.library_publication_sections x where x.version_id=p_version_id and x.source_id=s.id)
  ) then raise exception 'library_revision_publish_readable_content_required'; end if;

  -- Historical member passage state remains version-bound. Reader-facing RLS below exposes only
  -- current-version progress/highlights/notes/bookmarks; Research and discussion provenance stay historical.
  update public.library_publication_versions
     set version_status='superseded', superseded_at=now()
   where id=v_old_version_id and publication_id=v_publication_id and version_status='published';
  if not found then raise exception 'library_revision_old_active_version_invalid'; end if;

  update public.library_publication_versions
     set version_status='published', published_at=now(), superseded_at=null
   where id=p_version_id and publication_id=v_publication_id and version_status='draft';
  if not found then raise exception 'library_revision_new_version_transition_failed'; end if;

  update public.library_publications
     set active_version_id=p_version_id,
         title=v_new.title,
         subtitle=v_new.subtitle,
         description=v_new.description,
         publication_type=v_new.publication_type,
         author_name=v_new.author_name,
         publisher_name=v_new.publisher_name,
         language_code=v_new.language_code,
         cover_url=v_new.cover_url,
         isbn=v_new.isbn,
         publication_date=coalesce(v_new.publication_date, publication_date, current_date),
         is_free=v_new.is_free,
         updated_at=now()
   where id=v_publication_id and status='published' and active_version_id=v_old_version_id;
  if not found then raise exception 'library_revision_canonical_switch_failed'; end if;

  update public.library_publication_revision_reviews
     set published_at=now(), published_by=v_admin_id, updated_at=now()
   where version_id=p_version_id;
end;
$$;

revoke all on function public.create_library_author_revision(uuid) from public;
revoke all on function public.update_library_author_revision(uuid,text,text,text,text,text,text,text,text) from public;
revoke all on function public.prepare_library_author_revision_epub_source(uuid,bigint,text) from public;
revoke all on function public.submit_library_author_revision(uuid) from public;
revoke all on function public.review_library_author_revision(uuid,text,text) from public;
revoke all on function public.publish_library_author_revision(uuid) from public;
grant execute on function public.create_library_author_revision(uuid) to authenticated;
grant execute on function public.update_library_author_revision(uuid,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.prepare_library_author_revision_epub_source(uuid,bigint,text) to authenticated;
grant execute on function public.submit_library_author_revision(uuid) to authenticated;
grant execute on function public.review_library_author_revision(uuid,text,text) to authenticated;
grant execute on function public.publish_library_author_revision(uuid) to authenticated;

-- Reader-facing private state is preserved historically but ordinary Reader queries expose only
-- the canonical active version. Research items and passage-discussion provenance intentionally
-- remain readable as historical evidence and are NOT restricted here.
for_table_progress: begin end;
