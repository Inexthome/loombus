-- Allow an author to replace the cover of their currently published Library publication
-- without changing publication identity or publication/review state.
-- Draft cover creation/removal keeps using the existing draft-only RPCs. Submitted/review
-- states remain locked.

create or replace function public.library_current_user_can_access_cover(
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
      from public.library_publications p
      join public.library_author_publications a on a.publication_id = p.id
     where a.user_id = auth.uid()
       and a.retired_at is null
       and (
         (
           p.status = 'draft'
           and p.cover_url = p_storage_path
           and (
             p_write is false
             or a.submission_status in ('draft', 'changes_requested')
           )
         )
         or (
           p.status = 'published'
           and a.submission_status = 'approved'
           and p_storage_path like p.id::text || '/published-cover-%'
         )
       )
  );
$$;

revoke all on function public.library_current_user_can_access_cover(text, boolean) from public;
grant execute on function public.library_current_user_can_access_cover(text, boolean) to authenticated;

create or replace function public.prepare_library_author_published_cover(
  p_publication_id uuid,
  p_media_type text,
  p_byte_size bigint
)
returns table (
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
  v_retired_at timestamptz;
  v_storage_path text;
begin
  if v_user_id is null then
    raise exception 'library_cover_auth_required';
  end if;
  if p_media_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'library_cover_media_type_invalid';
  end if;
  if p_byte_size is null or p_byte_size < 1 or p_byte_size > 8388608 then
    raise exception 'library_cover_size_invalid';
  end if;

  select a.submission_status, a.retired_at, p.status
    into v_submission_status, v_retired_at, v_publication_status
    from public.library_author_publications a
    join public.library_publications p on p.id = a.publication_id
   where a.publication_id = p_publication_id
     and a.user_id = v_user_id
   for update of a, p;

  if v_submission_status is null then
    raise exception 'library_cover_publication_not_owned';
  end if;
  if v_retired_at is not null then
    raise exception 'library_cover_publication_retired';
  end if;
  if v_publication_status <> 'published' or v_submission_status <> 'approved' then
    raise exception 'library_cover_published_replacement_not_allowed';
  end if;

  -- Use a fresh object so the live cover remains intact until the new upload succeeds.
  v_storage_path := p_publication_id::text || '/published-cover-' || gen_random_uuid()::text;
  storage_bucket := 'library-publication-covers';
  storage_path := v_storage_path;
  return next;
end;
$$;

create or replace function public.commit_library_author_published_cover(
  p_publication_id uuid,
  p_storage_path text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission_status text;
  v_publication_status text;
  v_retired_at timestamptz;
  v_previous_path text;
begin
  if v_user_id is null then
    raise exception 'library_cover_auth_required';
  end if;
  if p_storage_path is null
     or p_storage_path not like p_publication_id::text || '/published-cover-%' then
    raise exception 'library_cover_storage_path_invalid';
  end if;

  select a.submission_status, a.retired_at, p.status, p.cover_url
    into v_submission_status, v_retired_at, v_publication_status, v_previous_path
    from public.library_author_publications a
    join public.library_publications p on p.id = a.publication_id
   where a.publication_id = p_publication_id
     and a.user_id = v_user_id
   for update of a, p;

  if v_submission_status is null then
    raise exception 'library_cover_publication_not_owned';
  end if;
  if v_retired_at is not null
     or v_publication_status <> 'published'
     or v_submission_status <> 'approved' then
    raise exception 'library_cover_published_replacement_not_allowed';
  end if;
  if not exists (
    select 1
      from storage.objects o
     where o.bucket_id = 'library-publication-covers'
       and o.name = p_storage_path
  ) then
    raise exception 'library_cover_uploaded_object_missing';
  end if;

  update public.library_publications
     set cover_url = p_storage_path,
         updated_at = now()
   where id = p_publication_id
     and status = 'published';

  if not found then
    raise exception 'library_cover_published_replacement_not_allowed';
  end if;

  -- The publication row, ID, published status, author workflow status, and published_at
  -- are intentionally untouched. Return the old object path for best-effort cleanup.
  return v_previous_path;
end;
$$;

revoke all on function public.prepare_library_author_published_cover(uuid, text, bigint) from public;
revoke all on function public.commit_library_author_published_cover(uuid, text) from public;
grant execute on function public.prepare_library_author_published_cover(uuid, text, bigint) to authenticated;
grant execute on function public.commit_library_author_published_cover(uuid, text) to authenticated;

comment on function public.prepare_library_author_published_cover(uuid, text, bigint) is
  'Prepares a fresh private cover object path only for the authenticated owner of a currently published, approved Library publication.';
comment on function public.commit_library_author_published_cover(uuid, text) is
  'Atomically swaps only cover_url for an authenticated owner publication that remains published and approved; returns the previous path for optional cleanup.';
