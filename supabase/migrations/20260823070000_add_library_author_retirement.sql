-- Loombus Library author retirement for previously published, now-unpublished work.
--
-- Retirement gives authors a practical delete-from-workspace action without
-- destroying canonical publication history or downstream references.

alter table public.library_author_publications
  add column if not exists retired_at timestamptz;

create index if not exists library_author_publications_user_active_idx
  on public.library_author_publications(user_id, updated_at desc)
  where retired_at is null;

create or replace function public.retire_library_author_unpublished_publication(
  p_publication_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_published_at timestamptz;
  v_retired_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'library_author_auth_required';
  end if;

  select p.status, a.published_at, a.retired_at
    into v_status, v_published_at, v_retired_at
    from public.library_author_publications a
    join public.library_publications p
      on p.id = a.publication_id
   where a.publication_id = p_publication_id
     and a.user_id = v_user_id
   for update of a, p;

  if v_status is null then
    raise exception 'library_author_publication_not_owned';
  end if;

  if v_retired_at is not null then
    raise exception 'library_author_publication_already_retired';
  end if;

  if v_published_at is null then
    raise exception 'library_author_retire_requires_publication_history';
  end if;

  if v_status <> 'archived' then
    raise exception 'library_author_retire_requires_unpublished_state';
  end if;

  update public.library_author_publications
     set retired_at = now(),
         updated_at = now()
   where publication_id = p_publication_id
     and user_id = v_user_id
     and retired_at is null;

  if not found then
    raise exception 'library_author_publication_retire_failed';
  end if;
end;
$$;

revoke all on function public.retire_library_author_unpublished_publication(uuid) from public;
grant execute on function public.retire_library_author_unpublished_publication(uuid) to authenticated;

-- Retired publications remain archived and cannot be republished. First-publication
-- provenance remains intact for historical references.
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
  v_retired_at timestamptz;
begin
  if v_admin_id is null then
    raise exception 'library_publish_auth_required';
  end if;

  if not public.library_current_user_is_admin() then
    raise exception 'library_publish_admin_required';
  end if;

  select submission_status, retired_at
    into v_status, v_retired_at
    from public.library_author_publications
   where publication_id = p_publication_id
   for update;

  if v_status is null then
    raise exception 'library_publish_publication_not_found';
  end if;

  if v_retired_at is not null then
    raise exception 'library_publish_retired_publication_forbidden';
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

comment on column public.library_author_publications.retired_at is
  'Owner retirement timestamp for previously published work that is now archived. Retired work is hidden from the author workspace but canonical publication history remains preserved.';
comment on function public.retire_library_author_unpublished_publication(uuid) is
  'Owner-only retirement for a previously published canonical publication that is currently archived; preserves canonical and downstream Library history.';
