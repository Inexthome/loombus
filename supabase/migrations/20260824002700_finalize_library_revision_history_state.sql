-- Completed revisions leave the active editorial queue but remain durable history.

alter table public.library_publication_revision_reviews
  drop constraint if exists library_publication_revision_reviews_submission_status_check;
alter table public.library_publication_revision_reviews
  add constraint library_publication_revision_reviews_submission_status_check
  check (submission_status in ('draft','submitted','changes_requested','approved','rejected','published'));

drop policy if exists "authors read own library revision reviews" on public.library_publication_revision_reviews;
create policy "authors read own library revision reviews"
  on public.library_publication_revision_reviews for select to authenticated
  using (user_id = auth.uid() and submission_status <> 'published');

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
         is_free=v_new.is_free,updated_at=now()
   where id=v_publication_id and status='published' and active_version_id=v_old_version_id;
  if not found then raise exception 'library_revision_canonical_switch_failed'; end if;

  update public.library_publication_revision_reviews
     set submission_status='published',published_at=now(),published_by=v_admin_id,updated_at=now()
   where version_id=p_version_id;
end;
$$;

revoke all on function public.publish_library_author_revision(uuid) from public;
grant execute on function public.publish_library_author_revision(uuid) to authenticated;
