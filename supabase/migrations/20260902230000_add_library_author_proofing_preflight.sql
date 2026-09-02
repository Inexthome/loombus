-- Loombus Library author proofing + preflight gate.
--
-- An author submission is not eligible for editorial review until the author has
-- reviewed the normalized Reader proof and attested that they control the rights
-- necessary to publish the exact EPUB source currently staged for that version.
-- Attestations are bound to both source id and SHA-256 so replacing an EPUB
-- automatically makes any earlier confirmation stale.

create table if not exists public.library_author_proofing_attestations (
  version_id uuid primary key references public.library_publication_versions(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  source_id uuid not null references public.library_publication_sources(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  preview_confirmed_at timestamptz not null,
  rights_attested_at timestamptz not null,
  attestation_version smallint not null default 1 check (attestation_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_author_proofing_version_publication_fkey
    foreign key (version_id, publication_id)
    references public.library_publication_versions(id, publication_id)
    on delete cascade
);

create index if not exists library_author_proofing_publication_idx
  on public.library_author_proofing_attestations(publication_id, updated_at desc);
create index if not exists library_author_proofing_user_idx
  on public.library_author_proofing_attestations(user_id, updated_at desc);

alter table public.library_author_proofing_attestations enable row level security;
revoke all on table public.library_author_proofing_attestations from anon, authenticated;
grant select on table public.library_author_proofing_attestations to authenticated;

drop policy if exists "authors read own library proofing attestations" on public.library_author_proofing_attestations;
create policy "authors read own library proofing attestations"
  on public.library_author_proofing_attestations
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "admins read library proofing attestations" on public.library_author_proofing_attestations;
create policy "admins read library proofing attestations"
  on public.library_author_proofing_attestations
  for select to authenticated
  using (public.library_current_user_is_admin());

create or replace function public.confirm_library_author_proofing(
  p_version_id uuid,
  p_source_id uuid,
  p_preview_confirmed boolean,
  p_rights_attested boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_publication_id uuid;
  v_source_sha256 text;
  v_allowed boolean := false;
begin
  if v_user_id is null then
    raise exception 'library_proofing_auth_required';
  end if;
  if p_preview_confirmed is distinct from true then
    raise exception 'library_proofing_preview_confirmation_required';
  end if;
  if p_rights_attested is distinct from true then
    raise exception 'library_proofing_rights_attestation_required';
  end if;

  select s.publication_id, s.sha256
    into v_publication_id, v_source_sha256
    from public.library_publication_sources s
    join public.library_publication_versions v
      on v.id = s.version_id and v.publication_id = s.publication_id
   where s.id = p_source_id
     and s.version_id = p_version_id
     and s.ingestion_status = 'ready'
     and s.sha256 ~ '^[0-9a-f]{64}$'
     and exists (
       select 1
         from public.library_publication_sections x
        where x.version_id = s.version_id
          and x.source_id = s.id
     )
   for share of s, v;

  if v_publication_id is null then
    raise exception 'library_proofing_ready_source_required';
  end if;

  select (
    exists (
      select 1
        from public.library_author_publications a
        join public.library_publications p on p.id = a.publication_id
       where a.publication_id = v_publication_id
         and a.user_id = v_user_id
         and a.submission_status in ('draft', 'changes_requested')
         and p.status = 'draft'
         and p.active_version_id = p_version_id
    )
    or exists (
      select 1
        from public.library_publication_revision_reviews r
        join public.library_publications p on p.id = r.publication_id
        join public.library_publication_versions v
          on v.id = r.version_id and v.publication_id = r.publication_id
       where r.version_id = p_version_id
         and r.publication_id = v_publication_id
         and r.user_id = v_user_id
         and r.submission_status in ('draft', 'changes_requested')
         and p.status = 'published'
         and p.active_version_id <> r.version_id
         and v.version_status = 'draft'
    )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'library_proofing_version_not_editable';
  end if;

  insert into public.library_author_proofing_attestations (
    version_id,
    publication_id,
    source_id,
    user_id,
    source_sha256,
    preview_confirmed_at,
    rights_attested_at,
    attestation_version,
    updated_at
  ) values (
    p_version_id,
    v_publication_id,
    p_source_id,
    v_user_id,
    v_source_sha256,
    now(),
    now(),
    1,
    now()
  )
  on conflict (version_id) do update
    set publication_id = excluded.publication_id,
        source_id = excluded.source_id,
        user_id = excluded.user_id,
        source_sha256 = excluded.source_sha256,
        preview_confirmed_at = excluded.preview_confirmed_at,
        rights_attested_at = excluded.rights_attested_at,
        attestation_version = excluded.attestation_version,
        updated_at = now();
end;
$$;

revoke all on function public.confirm_library_author_proofing(uuid, uuid, boolean, boolean) from public;
grant execute on function public.confirm_library_author_proofing(uuid, uuid, boolean, boolean) to authenticated;

-- Replacing a source reuses the version-scoped source row. Clear the old author
-- confirmation before the source digest changes so UI and submission state fail closed.
create or replace function public.invalidate_library_author_proofing_on_source_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.sha256 is distinct from new.sha256
     or old.ingestion_status = 'ready' and new.ingestion_status <> 'ready' then
    delete from public.library_author_proofing_attestations
     where version_id = old.version_id;
  end if;
  return new;
end;
$$;

revoke all on function public.invalidate_library_author_proofing_on_source_change() from public;

drop trigger if exists invalidate_library_author_proofing_on_source_change
  on public.library_publication_sources;
create trigger invalidate_library_author_proofing_on_source_change
before update of sha256, ingestion_status on public.library_publication_sources
for each row
execute function public.invalidate_library_author_proofing_on_source_change();

-- First-publication submission now requires a source-bound author proof + rights attestation.
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
  v_version_id uuid;
begin
  if v_user_id is null then
    raise exception 'library_author_auth_required';
  end if;

  select a.submission_status, p.active_version_id
    into v_submission_status, v_version_id
    from public.library_author_publications a
    join public.library_publications p on p.id = a.publication_id
   where a.publication_id = p_publication_id
     and a.user_id = v_user_id
   for update of a, p;

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
       and active_version_id = v_version_id
       and char_length(btrim(title)) > 0
  ) then
    raise exception 'library_author_canonical_publication_not_submittable';
  end if;

  if not exists (
    select 1
      from public.library_publication_sources s
     where s.publication_id = p_publication_id
       and s.version_id = v_version_id
       and s.ingestion_status = 'ready'
       and exists (
         select 1
           from public.library_publication_sections x
          where x.publication_id = p_publication_id
            and x.version_id = v_version_id
            and x.source_id = s.id
       )
       and exists (
         select 1
           from public.library_author_proofing_attestations proof
          where proof.version_id = v_version_id
            and proof.publication_id = p_publication_id
            and proof.source_id = s.id
            and proof.user_id = v_user_id
            and proof.source_sha256 = s.sha256
            and proof.preview_confirmed_at is not null
            and proof.rights_attested_at is not null
            and proof.attestation_version = 1
       )
  ) then
    raise exception 'library_author_current_source_proofing_required';
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

-- Revision submission carries the same source-bound proofing contract while the
-- existing live version remains untouched.
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
  if v_user_id is null then
    raise exception 'library_revision_auth_required';
  end if;

  select r.submission_status, r.publication_id
    into v_status, v_publication_id
    from public.library_publication_revision_reviews r
    join public.library_publications p on p.id = r.publication_id
    join public.library_publication_versions v
      on v.id = r.version_id and v.publication_id = r.publication_id
   where r.version_id = p_version_id
     and r.user_id = v_user_id
     and p.status = 'published'
     and p.active_version_id <> r.version_id
     and v.version_status = 'draft'
   for update of r, v;

  if v_status is null then raise exception 'library_revision_not_owned'; end if;
  if v_status not in ('draft', 'changes_requested') then raise exception 'library_revision_not_submittable'; end if;

  if not exists (
    select 1
      from public.library_publication_sources s
     where s.version_id = p_version_id
       and s.publication_id = v_publication_id
       and s.ingestion_status = 'ready'
       and exists (
         select 1
           from public.library_publication_sections x
          where x.version_id = p_version_id
            and x.source_id = s.id
       )
       and exists (
         select 1
           from public.library_author_proofing_attestations proof
          where proof.version_id = p_version_id
            and proof.publication_id = v_publication_id
            and proof.source_id = s.id
            and proof.user_id = v_user_id
            and proof.source_sha256 = s.sha256
            and proof.preview_confirmed_at is not null
            and proof.rights_attested_at is not null
            and proof.attestation_version = 1
       )
  ) then
    raise exception 'library_revision_current_source_proofing_required';
  end if;

  update public.library_publication_revision_reviews
     set submission_status = 'submitted',
         submitted_at = now(),
         reviewed_at = null,
         reviewed_by = null,
         review_note = null,
         updated_at = now()
   where version_id = p_version_id;
end;
$$;

revoke all on function public.submit_library_author_revision(uuid) from public;
grant execute on function public.submit_library_author_revision(uuid) to authenticated;

comment on table public.library_author_proofing_attestations is
  'Source-bound author preview confirmation and rights attestation required before a Library publication or revision can enter editorial review.';
comment on function public.confirm_library_author_proofing(uuid, uuid, boolean, boolean) is
  'Records author confirmation for the exact ready EPUB source and normalized Reader proof currently staged for an editable publication version.';
comment on function public.submit_library_author_publication(uuid) is
  'Submits an authenticated author-owned draft only when readable content and a matching source-bound proof/rights attestation are current.';
comment on function public.submit_library_author_revision(uuid) is
  'Submits an authenticated author-owned staged revision only when readable content and a matching source-bound proof/rights attestation are current.';