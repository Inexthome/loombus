-- Loombus Library published-revision schema.
-- Staged revisions use their own immutable version identity while the current version stays live.

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
revoke all on table public.library_publication_revision_reviews from anon, authenticated;
grant select on table public.library_publication_revision_reviews to authenticated;

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

drop policy if exists "authors read own library revision reviews" on public.library_publication_revision_reviews;
create policy "authors read own library revision reviews"
  on public.library_publication_revision_reviews for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "admins read library revision reviews" on public.library_publication_revision_reviews;
create policy "admins read library revision reviews"
  on public.library_publication_revision_reviews for select to authenticated
  using (public.library_current_user_is_admin());

drop policy if exists "authors read own normalized revision sections" on public.library_publication_sections;
create policy "authors read own normalized revision sections"
  on public.library_publication_sections for select to authenticated
  using (
    exists (
      select 1 from public.library_publication_revision_reviews r
      where r.version_id = library_publication_sections.version_id
        and r.publication_id = library_publication_sections.publication_id
        and r.user_id = auth.uid()
    )
  );

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

  select * into v_active
    from public.library_publication_versions
   where id = v_active_version_id
     and publication_id = p_publication_id
     and version_status = 'published'
   for share;
  if v_active.id is null then raise exception 'library_revision_active_version_invalid'; end if;

  select coalesce(max(version_number),0) + 1
    into v_next_number
    from public.library_publication_versions
   where publication_id = p_publication_id;

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

  select r.submission_status, r.publication_id
    into v_status, v_publication_id
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
   where id = p_version_id
     and publication_id = v_publication_id
     and version_status = 'draft';

  update public.library_publication_revision_reviews
     set updated_at = now()
   where version_id = p_version_id;
end;
$$;

revoke all on function public.create_library_author_revision(uuid) from public;
revoke all on function public.update_library_author_revision(uuid,text,text,text,text,text,text,text,text) from public;
grant execute on function public.create_library_author_revision(uuid) to authenticated;
grant execute on function public.update_library_author_revision(uuid,text,text,text,text,text,text,text,text) to authenticated;

comment on table public.library_publication_revision_reviews is
  'Private editorial state for one staged revision of an already-published Library publication.';
comment on function public.create_library_author_revision(uuid) is
  'Creates one private next-version metadata snapshot for an authenticated owner of a currently published work; the live version is unchanged.';
