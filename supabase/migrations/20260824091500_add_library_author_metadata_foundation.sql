-- Loombus Library author identity bridge + richer bibliographic metadata foundation.
--
-- Identity rule:
--   * `profiles` remains the only Loombus member/profile identity system.
--   * `library_author_publications.user_id` is the ownership bridge from a Library work to
--     that existing profile.
--   * `author_name` remains the publication's formal byline and is never overwritten from
--     profile.full_name. This preserves pen names, publisher-owned works, and formal credits.
--
-- Metadata rule:
--   * richer bibliographic fields live on both canonical publications and immutable version
--     snapshots so every published version preserves the metadata that accompanied its text.
--   * no page count is introduced because EPUB pagination is renderer-dependent.

alter table public.library_publications
  add column if not exists series_title text,
  add column if not exists series_position numeric(8,2),
  add column if not exists edition_label text,
  add column if not exists subjects text[] not null default '{}'::text[],
  add column if not exists audience_label text;

alter table public.library_publication_versions
  add column if not exists series_title text,
  add column if not exists series_position numeric(8,2),
  add column if not exists edition_label text,
  add column if not exists subjects text[] not null default '{}'::text[],
  add column if not exists audience_label text;

alter table public.library_publications
  add constraint library_publications_series_title_length_check
    check (series_title is null or char_length(btrim(series_title)) between 1 and 200),
  add constraint library_publications_series_position_check
    check (series_position is null or series_position > 0),
  add constraint library_publications_edition_label_length_check
    check (edition_label is null or char_length(btrim(edition_label)) between 1 and 100),
  add constraint library_publications_subjects_count_check
    check (cardinality(subjects) <= 12),
  add constraint library_publications_audience_label_length_check
    check (audience_label is null or char_length(btrim(audience_label)) between 1 and 120);

alter table public.library_publication_versions
  add constraint library_publication_versions_series_title_length_check
    check (series_title is null or char_length(btrim(series_title)) between 1 and 200),
  add constraint library_publication_versions_series_position_check
    check (series_position is null or series_position > 0),
  add constraint library_publication_versions_edition_label_length_check
    check (edition_label is null or char_length(btrim(edition_label)) between 1 and 100),
  add constraint library_publication_versions_subjects_count_check
    check (cardinality(subjects) <= 12),
  add constraint library_publication_versions_audience_label_length_check
    check (audience_label is null or char_length(btrim(audience_label)) between 1 and 120);

create or replace function public.library_normalize_subjects(p_subjects text[])
returns text[]
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_subject text;
  v_result text[] := '{}'::text[];
  v_seen text[] := '{}'::text[];
  v_key text;
begin
  if p_subjects is null then
    return '{}'::text[];
  end if;

  if cardinality(p_subjects) > 12 then
    raise exception 'library_metadata_subjects_too_many';
  end if;

  foreach v_subject in array p_subjects loop
    v_subject := btrim(coalesce(v_subject, ''));
    if v_subject = '' then
      continue;
    end if;
    if char_length(v_subject) > 80 then
      raise exception 'library_metadata_subject_too_long';
    end if;
    v_key := lower(v_subject);
    if not (v_key = any(v_seen)) then
      v_seen := array_append(v_seen, v_key);
      v_result := array_append(v_result, v_subject);
    end if;
  end loop;

  return v_result;
end;
$$;

revoke all on function public.library_normalize_subjects(text[]) from public;

-- Version 1 draft metadata follows the canonical draft. Published/superseded snapshots remain
-- immutable historical truth.
create or replace function public.library_sync_initial_publication_version()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_version_id uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.library_publication_versions (
      publication_id, version_number, version_status, title, subtitle, description,
      publication_type, author_name, publisher_name, language_code, cover_url, isbn,
      publication_date, is_free, series_title, series_position, edition_label, subjects,
      audience_label, published_at, created_at
    ) values (
      new.id, 1, case when new.status = 'draft' then 'draft' else 'published' end,
      new.title, new.subtitle, new.description, new.publication_type, new.author_name,
      new.publisher_name, new.language_code, new.cover_url, new.isbn, new.publication_date,
      new.is_free, new.series_title, new.series_position, new.edition_label,
      coalesce(new.subjects, '{}'::text[]), new.audience_label,
      case when new.status = 'draft' then null else coalesce(new.updated_at, new.created_at, now()) end,
      coalesce(new.created_at, now())
    ) returning id into v_version_id;

    update public.library_publications
       set active_version_id = v_version_id
     where id = new.id;
    return null;
  end if;

  select active_version_id into v_version_id
    from public.library_publications
   where id = new.id;
  if v_version_id is null then return null; end if;

  update public.library_publication_versions v
     set title = new.title,
         subtitle = new.subtitle,
         description = new.description,
         publication_type = new.publication_type,
         author_name = new.author_name,
         publisher_name = new.publisher_name,
         language_code = new.language_code,
         cover_url = new.cover_url,
         isbn = new.isbn,
         publication_date = new.publication_date,
         is_free = new.is_free,
         series_title = new.series_title,
         series_position = new.series_position,
         edition_label = new.edition_label,
         subjects = coalesce(new.subjects, '{}'::text[]),
         audience_label = new.audience_label,
         version_status = case when v.version_status = 'draft' and new.status = 'published' then 'published' else v.version_status end,
         published_at = case
           when v.version_status = 'draft' and new.status = 'published'
             then coalesce(v.published_at, new.updated_at, now())
           else v.published_at
         end
   where v.id = v_version_id
     and v.publication_id = new.id
     and v.version_status = 'draft';

  return null;
end;
$$;

revoke all on function public.library_sync_initial_publication_version() from public;

drop trigger if exists library_publications_sync_initial_version_update on public.library_publications;
create trigger library_publications_sync_initial_version_update
after update of title, subtitle, description, publication_type, author_name, publisher_name,
  language_code, cover_url, isbn, publication_date, is_free, status,
  series_title, series_position, edition_label, subjects, audience_label
on public.library_publications
for each row execute function public.library_sync_initial_publication_version();

-- Extend immutable-version protection to the richer bibliographic fields.
create or replace function public.library_guard_immutable_publication_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    if old.version_status in ('published', 'superseded') then
      raise exception 'library_published_version_is_immutable';
    end if;
    return old;
  end if;

  if old.version_status = 'superseded' then
    raise exception 'library_superseded_version_is_immutable';
  end if;

  if old.version_status = 'published' then
    if new.publication_id is distinct from old.publication_id
       or new.version_number is distinct from old.version_number
       or new.title is distinct from old.title
       or new.subtitle is distinct from old.subtitle
       or new.description is distinct from old.description
       or new.publication_type is distinct from old.publication_type
       or new.author_name is distinct from old.author_name
       or new.publisher_name is distinct from old.publisher_name
       or new.language_code is distinct from old.language_code
       or new.cover_url is distinct from old.cover_url
       or new.isbn is distinct from old.isbn
       or new.publication_date is distinct from old.publication_date
       or new.is_free is distinct from old.is_free
       or new.series_title is distinct from old.series_title
       or new.series_position is distinct from old.series_position
       or new.edition_label is distinct from old.edition_label
       or new.subjects is distinct from old.subjects
       or new.audience_label is distinct from old.audience_label
       or new.published_at is distinct from old.published_at
       or new.created_at is distinct from old.created_at
       or new.version_status <> 'superseded'
       or new.superseded_at is null then
      raise exception 'library_published_version_is_immutable';
    end if;
  end if;

  return new;
end;
$$;

-- Metadata edits for a first-publication draft. Main title/byline metadata continues through
-- the existing draft RPC; this function owns only the richer bibliographic fields.
create or replace function public.update_library_author_bibliographic_metadata(
  p_publication_id uuid,
  p_series_title text default null,
  p_series_position numeric default null,
  p_edition_label text default null,
  p_subjects text[] default '{}'::text[],
  p_audience_label text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_subjects text[];
begin
  if v_user_id is null then raise exception 'library_metadata_auth_required'; end if;
  if p_series_title is not null and char_length(btrim(p_series_title)) not between 1 and 200 then raise exception 'library_metadata_series_title_invalid'; end if;
  if p_series_position is not null and p_series_position <= 0 then raise exception 'library_metadata_series_position_invalid'; end if;
  if p_edition_label is not null and char_length(btrim(p_edition_label)) not between 1 and 100 then raise exception 'library_metadata_edition_label_invalid'; end if;
  if p_audience_label is not null and char_length(btrim(p_audience_label)) not between 1 and 120 then raise exception 'library_metadata_audience_label_invalid'; end if;
  v_subjects := public.library_normalize_subjects(p_subjects);

  select a.submission_status into v_status
    from public.library_author_publications a
    join public.library_publications p on p.id = a.publication_id
   where a.publication_id = p_publication_id
     and a.user_id = v_user_id
     and a.retired_at is null
     and p.status = 'draft'
   for update of a, p;
  if v_status is null then raise exception 'library_metadata_publication_not_owned'; end if;
  if v_status not in ('draft','changes_requested') then raise exception 'library_metadata_publication_not_editable'; end if;

  update public.library_publications
     set series_title = nullif(btrim(coalesce(p_series_title,'')),''),
         series_position = p_series_position,
         edition_label = nullif(btrim(coalesce(p_edition_label,'')),''),
         subjects = v_subjects,
         audience_label = nullif(btrim(coalesce(p_audience_label,'')),''),
         updated_at = now()
   where id = p_publication_id and status = 'draft';
end;
$$;

create or replace function public.update_library_author_revision_bibliographic_metadata(
  p_version_id uuid,
  p_series_title text default null,
  p_series_position numeric default null,
  p_edition_label text default null,
  p_subjects text[] default '{}'::text[],
  p_audience_label text default null
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
  v_subjects text[];
begin
  if v_user_id is null then raise exception 'library_revision_metadata_auth_required'; end if;
  if p_series_title is not null and char_length(btrim(p_series_title)) not between 1 and 200 then raise exception 'library_revision_metadata_series_title_invalid'; end if;
  if p_series_position is not null and p_series_position <= 0 then raise exception 'library_revision_metadata_series_position_invalid'; end if;
  if p_edition_label is not null and char_length(btrim(p_edition_label)) not between 1 and 100 then raise exception 'library_revision_metadata_edition_label_invalid'; end if;
  if p_audience_label is not null and char_length(btrim(p_audience_label)) not between 1 and 120 then raise exception 'library_revision_metadata_audience_label_invalid'; end if;
  v_subjects := public.library_normalize_subjects(p_subjects);

  select r.submission_status, r.publication_id
    into v_status, v_publication_id
    from public.library_publication_revision_reviews r
    join public.library_publication_versions v
      on v.id = r.version_id and v.publication_id = r.publication_id
    join public.library_publications p on p.id = r.publication_id
   where r.version_id = p_version_id
     and r.user_id = v_user_id
     and r.published_at is null
     and v.version_status = 'draft'
     and p.status = 'published'
     and p.active_version_id <> r.version_id
   for update of r, v;
  if v_status is null then raise exception 'library_revision_metadata_not_owned_or_editable'; end if;
  if v_status not in ('draft','changes_requested') then raise exception 'library_revision_metadata_not_editable'; end if;

  update public.library_publication_versions
     set series_title = nullif(btrim(coalesce(p_series_title,'')),''),
         series_position = p_series_position,
         edition_label = nullif(btrim(coalesce(p_edition_label,'')),''),
         subjects = v_subjects,
         audience_label = nullif(btrim(coalesce(p_audience_label,'')),'')
   where id = p_version_id
     and publication_id = v_publication_id
     and version_status = 'draft';

  update public.library_publication_revision_reviews
     set updated_at = now()
   where version_id = p_version_id;
end;
$$;

revoke all on function public.update_library_author_bibliographic_metadata(uuid,text,numeric,text,text[],text) from public;
revoke all on function public.update_library_author_revision_bibliographic_metadata(uuid,text,numeric,text,text[],text) from public;
grant execute on function public.update_library_author_bibliographic_metadata(uuid,text,numeric,text,text[],text) to authenticated;
grant execute on function public.update_library_author_revision_bibliographic_metadata(uuid,text,numeric,text,text[],text) to authenticated;

-- Future revisions must snapshot richer metadata from the currently active immutable version.
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

  select p.active_version_id into v_active_version_id
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
      and r.published_at is null
      and r.submission_status in ('draft','submitted','changes_requested','approved')
  ) then raise exception 'library_revision_already_open'; end if;

  select * into v_active
    from public.library_publication_versions
   where id = v_active_version_id
     and publication_id = p_publication_id
     and version_status = 'published'
   for share;
  if v_active.id is null then raise exception 'library_revision_active_version_invalid'; end if;

  select coalesce(max(version_number),0) + 1 into v_next_number
    from public.library_publication_versions
   where publication_id = p_publication_id;

  insert into public.library_publication_versions (
    id, publication_id, version_number, version_status, title, subtitle, description,
    publication_type, author_name, publisher_name, language_code, cover_url, isbn,
    publication_date, is_free, series_title, series_position, edition_label, subjects,
    audience_label
  ) values (
    v_version_id, p_publication_id, v_next_number, 'draft', v_active.title, v_active.subtitle,
    v_active.description, v_active.publication_type, v_active.author_name, v_active.publisher_name,
    v_active.language_code, v_active.cover_url, v_active.isbn, v_active.publication_date,
    v_active.is_free, v_active.series_title, v_active.series_position, v_active.edition_label,
    v_active.subjects, v_active.audience_label
  );

  insert into public.library_publication_revision_reviews(version_id, publication_id, user_id)
  values (v_version_id, p_publication_id, v_user_id);

  return v_version_id;
end;
$$;

revoke all on function public.create_library_author_revision(uuid) from public;
grant execute on function public.create_library_author_revision(uuid) to authenticated;

-- Explicit revision publication also carries the richer immutable metadata onto canonical truth.
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

  select r.publication_id,r.submission_status,p.active_version_id
    into v_publication_id,v_status,v_old_version_id
    from public.library_publication_revision_reviews r
    join public.library_publications p on p.id=r.publication_id
   where r.version_id=p_version_id and p.status='published'
   for update of r,p;
  if v_publication_id is null then raise exception 'library_revision_publish_not_found'; end if;
  if v_status<>'approved' then raise exception 'library_revision_publish_not_approved'; end if;
  if v_old_version_id=p_version_id then raise exception 'library_revision_already_active'; end if;

  select * into v_new from public.library_publication_versions
   where id=p_version_id and publication_id=v_publication_id and version_status='draft'
   for update;
  if v_new.id is null then raise exception 'library_revision_publish_version_invalid'; end if;
  if not exists (
    select 1 from public.library_publication_sources s
    where s.version_id=p_version_id and s.publication_id=v_publication_id and s.ingestion_status='ready'
      and exists (select 1 from public.library_publication_sections x where x.version_id=p_version_id and x.source_id=s.id)
  ) then raise exception 'library_revision_publish_readable_content_required'; end if;

  update public.library_publication_versions
     set version_status='superseded',superseded_at=now()
   where id=v_old_version_id and publication_id=v_publication_id and version_status='published';
  if not found then raise exception 'library_revision_old_active_version_invalid'; end if;

  update public.library_publication_versions
     set version_status='published',published_at=now(),superseded_at=null
   where id=p_version_id and publication_id=v_publication_id and version_status='draft';
  if not found then raise exception 'library_revision_new_version_transition_failed'; end if;

  update public.library_publications
     set active_version_id=p_version_id,
         title=v_new.title,subtitle=v_new.subtitle,description=v_new.description,
         publication_type=v_new.publication_type,author_name=v_new.author_name,
         publisher_name=v_new.publisher_name,language_code=v_new.language_code,
         cover_url=v_new.cover_url,isbn=v_new.isbn,
         publication_date=coalesce(v_new.publication_date,publication_date,current_date),
         is_free=v_new.is_free,
         series_title=v_new.series_title,
         series_position=v_new.series_position,
         edition_label=v_new.edition_label,
         subjects=v_new.subjects,
         audience_label=v_new.audience_label,
         updated_at=now()
   where id=v_publication_id and status='published' and active_version_id=v_old_version_id;
  if not found then raise exception 'library_revision_canonical_switch_failed'; end if;

  update public.library_publication_revision_reviews
     set submission_status='published',published_at=now(),published_by=v_admin_id,updated_at=now()
   where version_id=p_version_id;
end;
$$;

revoke all on function public.publish_library_author_revision(uuid) from public;
grant execute on function public.publish_library_author_revision(uuid) to authenticated;

-- Authenticated-only bridge from a published Library work to the author's existing Loombus
-- profile. It returns only fields already used by `/u/[username]`; there is no Library-specific
-- profile record and no anonymous profile-identity expansion.
create or replace function public.get_library_published_author_profile(p_publication_id uuid)
returns table (
  username text,
  full_name text,
  bio text,
  avatar_url text,
  perspective_marker text,
  creator_website_url text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'library_author_profile_auth_required';
  end if;

  return query
  select pr.username, pr.full_name, pr.bio, pr.avatar_url, pr.perspective_marker,
         pr.creator_website_url
    from public.library_publications p
    join public.library_author_publications a on a.publication_id = p.id
    join public.profiles pr on pr.id = a.user_id
   where p.id = p_publication_id
     and p.status = 'published'
     and a.retired_at is null
     and pr.username is not null
     and btrim(pr.username) <> ''
   limit 1;
end;
$$;

revoke all on function public.get_library_published_author_profile(uuid) from public;
grant execute on function public.get_library_published_author_profile(uuid) to authenticated;

comment on function public.update_library_author_bibliographic_metadata(uuid,text,numeric,text,text[],text) is
  'Owner-only richer bibliographic metadata update for an editable first-publication draft. Version 1 is synchronized by the canonical draft trigger.';
comment on function public.update_library_author_revision_bibliographic_metadata(uuid,text,numeric,text,text[],text) is
  'Owner-only richer bibliographic metadata update for an editable staged publication revision.';
comment on function public.get_library_published_author_profile(uuid) is
  'Authenticated-only bridge from a published Library work to its owner existing Loombus public profile fields. The formal publication byline remains independent.';
