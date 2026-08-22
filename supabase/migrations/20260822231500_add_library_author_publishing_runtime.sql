-- Loombus Library authenticated author publishing runtime.
--
-- Adds narrowly scoped SECURITY DEFINER RPC functions for member-owned draft
-- creation, draft metadata editing, and submission. Authors never receive direct
-- INSERT/UPDATE/DELETE privileges on canonical publication or review tables.
-- Existing publication status, review decisions, EPUB ingestion, and Storage remain
-- controlled outside this member runtime.

create or replace function public.create_library_author_draft(
  p_title text,
  p_author_name text default null,
  p_publication_type text default 'book',
  p_subtitle text default null,
  p_description text default null,
  p_publisher_name text default null,
  p_language_code text default 'en',
  p_isbn text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_publication_id uuid := gen_random_uuid();
  v_slug_base text;
  v_slug text;
begin
  if v_user_id is null then
    raise exception 'library_author_auth_required';
  end if;

  if p_title is null or char_length(btrim(p_title)) = 0 or char_length(btrim(p_title)) > 200 then
    raise exception 'library_author_title_invalid';
  end if;

  if p_publication_type not in ('book','essay','research','report','guide','article','other') then
    raise exception 'library_author_publication_type_invalid';
  end if;

  if p_language_code is null or char_length(btrim(p_language_code)) not between 2 and 12 then
    raise exception 'library_author_language_invalid';
  end if;

  v_slug_base := trim(both '-' from regexp_replace(lower(btrim(p_title)), '[^a-z0-9]+', '-', 'g'));
  if v_slug_base = '' then
    v_slug_base := 'publication';
  end if;
  v_slug := left(v_slug_base, 80) || '-' || substr(replace(v_publication_id::text, '-', ''), 1, 10);

  insert into public.library_publications (
    id,
    slug,
    title,
    subtitle,
    description,
    publication_type,
    author_name,
    publisher_name,
    language_code,
    isbn,
    status,
    is_free
  ) values (
    v_publication_id,
    v_slug,
    btrim(p_title),
    nullif(btrim(coalesce(p_subtitle, '')), ''),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_publication_type,
    nullif(btrim(coalesce(p_author_name, '')), ''),
    nullif(btrim(coalesce(p_publisher_name, '')), ''),
    btrim(p_language_code),
    nullif(btrim(coalesce(p_isbn, '')), ''),
    'draft',
    true
  );

  insert into public.library_author_publications (
    publication_id,
    user_id,
    submission_status
  ) values (
    v_publication_id,
    v_user_id,
    'draft'
  );

  return v_publication_id;
end;
$$;

create or replace function public.update_library_author_draft(
  p_publication_id uuid,
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
  v_submission_status text;
begin
  if v_user_id is null then
    raise exception 'library_author_auth_required';
  end if;

  if p_title is null or char_length(btrim(p_title)) = 0 or char_length(btrim(p_title)) > 200 then
    raise exception 'library_author_title_invalid';
  end if;

  if p_publication_type not in ('book','essay','research','report','guide','article','other') then
    raise exception 'library_author_publication_type_invalid';
  end if;

  if p_language_code is null or char_length(btrim(p_language_code)) not between 2 and 12 then
    raise exception 'library_author_language_invalid';
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
    raise exception 'library_author_publication_not_editable';
  end if;

  update public.library_publications
     set title = btrim(p_title),
         subtitle = nullif(btrim(coalesce(p_subtitle, '')), ''),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         publication_type = p_publication_type,
         author_name = nullif(btrim(coalesce(p_author_name, '')), ''),
         publisher_name = nullif(btrim(coalesce(p_publisher_name, '')), ''),
         language_code = btrim(p_language_code),
         isbn = nullif(btrim(coalesce(p_isbn, '')), ''),
         updated_at = now()
   where id = p_publication_id
     and status = 'draft';

  if not found then
    raise exception 'library_author_canonical_publication_not_editable';
  end if;

  update public.library_author_publications
     set updated_at = now()
   where publication_id = p_publication_id
     and user_id = v_user_id;
end;
$$;

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

revoke all on function public.create_library_author_draft(text, text, text, text, text, text, text, text) from public;
revoke all on function public.update_library_author_draft(uuid, text, text, text, text, text, text, text, text) from public;
revoke all on function public.submit_library_author_publication(uuid) from public;

grant execute on function public.create_library_author_draft(text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.update_library_author_draft(uuid, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.submit_library_author_publication(uuid) to authenticated;

comment on function public.create_library_author_draft(text, text, text, text, text, text, text, text) is
  'Creates one canonical draft publication plus its private authenticated author ownership row. Never publishes content.';
comment on function public.update_library_author_draft(uuid, text, text, text, text, text, text, text, text) is
  'Edits metadata only for an authenticated author-owned draft or changes-requested publication. Cannot alter canonical publication status or review state.';
comment on function public.submit_library_author_publication(uuid) is
  'Moves an authenticated author-owned draft into submitted review state. Does not publish or approve the publication.';
