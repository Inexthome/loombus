-- Loombus Library publication cover foundation.
-- Covers use a dedicated private Storage bucket. Draft covers are readable only by the
-- owning author and admins; ordinary users may read a cover only while its canonical
-- publication is currently published.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-publication-covers',
  'library-publication-covers',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

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
      join public.library_author_publications a
        on a.publication_id = p.id
     where p.cover_url = p_storage_path
       and a.user_id = auth.uid()
       and a.retired_at is null
       and p.status = 'draft'
       and (
         p_write is false
         or a.submission_status in ('draft', 'changes_requested')
       )
  );
$$;

revoke all on function public.library_current_user_can_access_cover(text, boolean) from public;
grant execute on function public.library_current_user_can_access_cover(text, boolean) to authenticated;

create or replace function public.prepare_library_author_cover(
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
    join public.library_publications p
      on p.id = a.publication_id
   where a.publication_id = p_publication_id
     and a.user_id = v_user_id
   for update of a, p;

  if v_submission_status is null then
    raise exception 'library_cover_publication_not_owned';
  end if;

  if v_retired_at is not null then
    raise exception 'library_cover_publication_retired';
  end if;

  if v_submission_status not in ('draft', 'changes_requested') then
    raise exception 'library_cover_publication_not_editable';
  end if;

  if v_publication_status <> 'draft' then
    raise exception 'library_cover_canonical_publication_not_editable';
  end if;

  v_storage_path := p_publication_id::text || '/cover';

  update public.library_publications
     set cover_url = v_storage_path,
         updated_at = now()
   where id = p_publication_id;

  storage_bucket := 'library-publication-covers';
  storage_path := v_storage_path;
  return next;
end;
$$;

revoke all on function public.prepare_library_author_cover(uuid, text, bigint) from public;
grant execute on function public.prepare_library_author_cover(uuid, text, bigint) to authenticated;

create or replace function public.clear_library_author_cover(
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
  v_publication_status text;
  v_retired_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'library_cover_auth_required';
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
  if v_retired_at is not null or v_publication_status <> 'draft'
     or v_submission_status not in ('draft', 'changes_requested') then
    raise exception 'library_cover_publication_not_editable';
  end if;

  update public.library_publications
     set cover_url = null,
         updated_at = now()
   where id = p_publication_id;
end;
$$;

revoke all on function public.clear_library_author_cover(uuid) from public;
grant execute on function public.clear_library_author_cover(uuid) to authenticated;

-- Author exact-path writes and draft reads.
drop policy if exists "authors insert own library publication covers" on storage.objects;
create policy "authors insert own library publication covers"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'library-publication-covers'
    and public.library_current_user_can_access_cover(name, true)
  );

drop policy if exists "authors update own library publication covers" on storage.objects;
create policy "authors update own library publication covers"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'library-publication-covers'
    and public.library_current_user_can_access_cover(name, true)
  )
  with check (
    bucket_id = 'library-publication-covers'
    and public.library_current_user_can_access_cover(name, true)
  );

drop policy if exists "authors delete own library publication covers" on storage.objects;
create policy "authors delete own library publication covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'library-publication-covers'
    and public.library_current_user_can_access_cover(name, true)
  );

drop policy if exists "authors read own draft library publication covers" on storage.objects;
create policy "authors read own draft library publication covers"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'library-publication-covers'
    and public.library_current_user_can_access_cover(name, false)
  );

-- Admin review access to cover artwork. This does not grant mutation rights.
drop policy if exists "admins read library publication covers" on storage.objects;
create policy "admins read library publication covers"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'library-publication-covers'
    and exists (
      select 1
        from public.profiles pr
       where pr.id = auth.uid()
         and pr.is_admin = true
    )
  );

-- Published cover artwork is readable from the private bucket by anyone only when the
-- object path is still bound to a currently published canonical publication.
drop policy if exists "published library publication covers are readable" on storage.objects;
create policy "published library publication covers are readable"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'library-publication-covers'
    and exists (
      select 1
        from public.library_publications p
       where p.cover_url = storage.objects.name
         and p.status = 'published'
    )
  );

comment on function public.prepare_library_author_cover(uuid, text, bigint) is
  'Binds the deterministic private cover path for an authenticated owner-managed editable draft after validating image type and size.';
comment on function public.clear_library_author_cover(uuid) is
  'Clears cover metadata for an authenticated owner-managed editable draft after the cover object has been removed.';
