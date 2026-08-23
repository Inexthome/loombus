-- Loombus Library publication lifecycle controls.
--
-- Adds two distinct lifecycle paths:
-- 1. Admin unpublish/republish for works that have already been public. Historical
--    publication provenance is retained; unpublish archives instead of deleting.
-- 2. Author hard-delete only for never-published private work in author-controlled
--    states. The private original must be removed through Storage before the DB row
--    is deleted so we do not intentionally orphan original EPUB objects.

create or replace function public.library_current_user_can_delete_original(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
    and exists (
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
         and a.published_at is null
         and a.submission_status in ('draft', 'changes_requested', 'rejected')
         and p.status = 'draft'
    );
$$;

revoke all on function public.library_current_user_can_delete_original(text) from public;
grant execute on function public.library_current_user_can_delete_original(text) to authenticated;

-- Exact-path owner deletion only for never-published private originals. No broad
-- bucket DELETE permission is introduced.
drop policy if exists "authors delete own never-published library originals" on storage.objects;
create policy "authors delete own never-published library originals"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'library-publication-originals'
    and public.library_current_user_can_delete_original(name)
  );

create or replace function public.delete_library_author_unpublished_publication(
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
  v_published_at timestamptz;
  v_canonical_status text;
begin
  if v_user_id is null then
    raise exception 'library_author_auth_required';
  end if;

  select a.submission_status, a.published_at, p.status
    into v_submission_status, v_published_at, v_canonical_status
    from public.library_author_publications a
    join public.library_publications p
      on p.id = a.publication_id
   where a.publication_id = p_publication_id
     and a.user_id = v_user_id
   for update of a, p;

  if v_submission_status is null then
    raise exception 'library_author_publication_not_owned';
  end if;

  if v_published_at is not null or v_canonical_status <> 'draft' then
    raise exception 'library_author_delete_published_history_forbidden';
  end if;

  if v_submission_status not in ('draft', 'changes_requested', 'rejected') then
    raise exception 'library_author_publication_not_deletable_in_current_state';
  end if;

  delete from public.library_publications
   where id = p_publication_id
     and status = 'draft';

  if not found then
    raise exception 'library_author_publication_delete_failed';
  end if;
end;
$$;

revoke all on function public.delete_library_author_unpublished_publication(uuid) from public;
grant execute on function public.delete_library_author_unpublished_publication(uuid) to authenticated;

create or replace function public.unpublish_library_author_publication(
  p_publication_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'library_unpublish_auth_required';
  end if;

  if not public.library_current_user_is_admin() then
    raise exception 'library_unpublish_admin_required';
  end if;

  if not exists (
    select 1
      from public.library_author_publications a
     where a.publication_id = p_publication_id
       and a.submission_status = 'approved'
       and a.published_at is not null
  ) then
    raise exception 'library_unpublish_publication_not_published_author_work';
  end if;

  update public.library_publications
     set status = 'archived',
         updated_at = now()
   where id = p_publication_id
     and status = 'published';

  if not found then
    raise exception 'library_unpublish_canonical_publication_not_published';
  end if;

  update public.library_author_publications
     set updated_at = now()
   where publication_id = p_publication_id;
end;
$$;

revoke all on function public.unpublish_library_author_publication(uuid) from public;
grant execute on function public.unpublish_library_author_publication(uuid) to authenticated;

-- Publishing is also the republish path for an archived, previously approved work.
-- Historical published_at / published_by are retained instead of being rewritten.
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
     and status in ('draft', 'archived');

  if not found then
    raise exception 'library_publish_canonical_publication_not_publishable';
  end if;

  update public.library_author_publications
     set published_at = coalesce(published_at, now()),
         published_by = coalesce(published_by, v_admin_id),
         updated_at = now()
   where publication_id = p_publication_id;
end;
$$;

revoke all on function public.publish_library_author_publication(uuid) from public;
grant execute on function public.publish_library_author_publication(uuid) to authenticated;

comment on function public.delete_library_author_unpublished_publication(uuid) is
  'Author-owned hard delete for never-published private Library work in draft, changes-requested, or rejected state. Published history is fail-closed.';
comment on function public.unpublish_library_author_publication(uuid) is
  'Admin-only transition from published to archived that preserves publication history and normalized content for possible republishing.';
comment on function public.library_current_user_can_delete_original(text) is
  'Exact-path owner predicate for deleting a never-published private original EPUB before database deletion.';
