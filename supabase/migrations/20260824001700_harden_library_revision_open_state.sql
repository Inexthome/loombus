-- A completed approved revision is historical, not an open revision.

drop index if exists public.library_revision_reviews_one_open_per_publication_idx;
create unique index library_revision_reviews_one_open_per_publication_idx
  on public.library_publication_revision_reviews(publication_id)
  where published_at is null
    and submission_status in ('draft','submitted','changes_requested','approved');

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
    from public.library_publication_versions where publication_id = p_publication_id;

  insert into public.library_publication_versions (
    id,publication_id,version_number,version_status,title,subtitle,description,publication_type,
    author_name,publisher_name,language_code,cover_url,isbn,publication_date,is_free
  ) values (
    v_version_id,p_publication_id,v_next_number,'draft',v_active.title,v_active.subtitle,v_active.description,
    v_active.publication_type,v_active.author_name,v_active.publisher_name,v_active.language_code,
    v_active.cover_url,v_active.isbn,v_active.publication_date,v_active.is_free
  );

  insert into public.library_publication_revision_reviews(version_id,publication_id,user_id)
  values (v_version_id,p_publication_id,v_user_id);
  return v_version_id;
end;
$$;

revoke all on function public.create_library_author_revision(uuid) from public;
grant execute on function public.create_library_author_revision(uuid) to authenticated;
