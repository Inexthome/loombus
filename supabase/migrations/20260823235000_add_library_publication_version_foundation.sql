-- Loombus Library controlled published-revision foundation.
--
-- This migration introduces durable publication-version identity without changing today's
-- single-source/single-section publishing runtime. Existing content becomes Version 1,
-- current Reader/member provenance is bound to that version, and published Reader SELECTs
-- are restricted to the publication's active version.
--
-- Follow-on runtime work may stage Version 2+ content only after deliberately replacing the
-- legacy one-source/one-section-set constraints and updating author/admin review flows.

create table if not exists public.library_publication_versions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  version_status text not null default 'draft'
    check (version_status in ('draft', 'published', 'superseded')),
  title text not null,
  subtitle text,
  description text,
  publication_type text not null
    check (publication_type in ('book','essay','research','report','guide','article','other')),
  author_name text,
  publisher_name text,
  language_code text not null default 'en',
  cover_url text,
  isbn text,
  publication_date date,
  is_free boolean not null default true,
  published_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint library_publication_versions_number_unique
    unique (publication_id, version_number),
  constraint library_publication_versions_identity_unique
    unique (id, publication_id),
  constraint library_publication_versions_lifecycle_check check (
    (version_status = 'draft' and published_at is null and superseded_at is null)
    or (version_status = 'published' and published_at is not null and superseded_at is null)
    or (version_status = 'superseded' and published_at is not null and superseded_at is not null)
  )
);

create index if not exists library_publication_versions_publication_status_idx
  on public.library_publication_versions(publication_id, version_status, version_number desc);

alter table public.library_publication_versions enable row level security;
revoke all on table public.library_publication_versions from anon, authenticated;

alter table public.library_publications
  add column if not exists active_version_id uuid;

-- Backfill exactly one Version 1 snapshot for every existing canonical publication.
insert into public.library_publication_versions (
  publication_id,
  version_number,
  version_status,
  title,
  subtitle,
  description,
  publication_type,
  author_name,
  publisher_name,
  language_code,
  cover_url,
  isbn,
  publication_date,
  is_free,
  published_at,
  superseded_at,
  created_at
)
select
  p.id,
  1,
  case when p.status = 'draft' then 'draft' else 'published' end,
  p.title,
  p.subtitle,
  p.description,
  p.publication_type,
  p.author_name,
  p.publisher_name,
  p.language_code,
  p.cover_url,
  p.isbn,
  p.publication_date,
  p.is_free,
  case
    when p.status = 'draft' then null
    else coalesce(a.published_at, p.updated_at, p.created_at)
  end,
  null,
  p.created_at
from public.library_publications p
left join public.library_author_publications a
  on a.publication_id = p.id
on conflict (publication_id, version_number) do nothing;

update public.library_publications p
set active_version_id = v.id
from public.library_publication_versions v
where v.publication_id = p.id
  and v.version_number = 1
  and p.active_version_id is null;

alter table public.library_publications
  drop constraint if exists library_publications_active_version_fkey;
alter table public.library_publications
  add constraint library_publications_active_version_fkey
  foreign key (active_version_id)
  references public.library_publication_versions(id)
  on delete restrict;

-- Keep Version 1 synchronized while the canonical work is still a first-publication draft.
-- Once published, version metadata becomes immutable historical truth.
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
      publication_id,
      version_number,
      version_status,
      title,
      subtitle,
      description,
      publication_type,
      author_name,
      publisher_name,
      language_code,
      cover_url,
      isbn,
      publication_date,
      is_free,
      published_at,
      created_at
    ) values (
      new.id,
      1,
      case when new.status = 'draft' then 'draft' else 'published' end,
      new.title,
      new.subtitle,
      new.description,
      new.publication_type,
      new.author_name,
      new.publisher_name,
      new.language_code,
      new.cover_url,
      new.isbn,
      new.publication_date,
      new.is_free,
      case when new.status = 'draft' then null else coalesce(new.updated_at, new.created_at, now()) end,
      coalesce(new.created_at, now())
    )
    returning id into v_version_id;

    update public.library_publications
       set active_version_id = v_version_id
     where id = new.id;

    return null;
  end if;

  select active_version_id
    into v_version_id
    from public.library_publications
   where id = new.id;

  if v_version_id is null then
    return null;
  end if;

  -- Metadata may follow canonical edits only while Version 1 is still draft.
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
         version_status = case
           when v.version_status = 'draft' and new.status = 'published' then 'published'
           else v.version_status
         end,
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

drop trigger if exists library_publications_sync_initial_version_insert
  on public.library_publications;
create trigger library_publications_sync_initial_version_insert
after insert on public.library_publications
for each row execute function public.library_sync_initial_publication_version();

drop trigger if exists library_publications_sync_initial_version_update
  on public.library_publications;
create trigger library_publications_sync_initial_version_update
after update of title, subtitle, description, publication_type, author_name, publisher_name,
  language_code, cover_url, isbn, publication_date, is_free, status
on public.library_publications
for each row execute function public.library_sync_initial_publication_version();

-- Published/superseded snapshots may never have metadata rewritten or be deleted. The only
-- allowed mutation of a published snapshot is the future controlled published -> superseded
-- lifecycle transition.
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

drop trigger if exists library_publication_versions_immutable_guard
  on public.library_publication_versions;
create trigger library_publication_versions_immutable_guard
before update or delete on public.library_publication_versions
for each row execute function public.library_guard_immutable_publication_version();

-- Version identity on source + normalized sections. Existing one-source/one-section-set
-- uniqueness remains intentionally unchanged until the controlled-revision runtime PR.
alter table public.library_publication_sources
  add column if not exists version_id uuid;

update public.library_publication_sources s
set version_id = p.active_version_id
from public.library_publications p
where p.id = s.publication_id
  and s.version_id is null;

alter table public.library_publication_sources
  alter column version_id set not null;

alter table public.library_publication_sources
  add constraint library_publication_sources_version_publication_fkey
  foreign key (version_id, publication_id)
  references public.library_publication_versions(id, publication_id)
  on delete restrict;

alter table public.library_publication_sources
  add constraint library_publication_sources_identity_version_unique
  unique (id, publication_id, version_id);

alter table public.library_publication_sections
  add column if not exists version_id uuid;

update public.library_publication_sections s
set version_id = source.version_id
from public.library_publication_sources source
where source.id = s.source_id
  and source.publication_id = s.publication_id
  and s.version_id is null;

alter table public.library_publication_sections
  alter column version_id set not null;

alter table public.library_publication_sections
  add constraint library_publication_sections_version_publication_fkey
  foreign key (version_id, publication_id)
  references public.library_publication_versions(id, publication_id)
  on delete restrict;

alter table public.library_publication_sections
  add constraint library_publication_sections_source_version_fkey
  foreign key (source_id, publication_id, version_id)
  references public.library_publication_sources(id, publication_id, version_id)
  on delete cascade;

create index if not exists library_publication_sections_version_ordinal_idx
  on public.library_publication_sections(version_id, ordinal);

-- Preserve today's ingestion API: omitted version_id is filled from the publication's active
-- draft Version 1. #1028 will explicitly provide a staged revision version instead.
create or replace function public.library_assign_active_publication_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.version_id is null then
    select p.active_version_id
      into new.version_id
      from public.library_publications p
     where p.id = new.publication_id;
  end if;

  if new.version_id is null then
    raise exception 'library_publication_active_version_required';
  end if;

  return new;
end;
$$;

create or replace function public.library_assign_section_source_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.version_id is null then
    select s.version_id
      into new.version_id
      from public.library_publication_sources s
     where s.id = new.source_id
       and s.publication_id = new.publication_id;
  end if;

  if new.version_id is null then
    raise exception 'library_section_source_version_required';
  end if;

  return new;
end;
$$;

drop trigger if exists library_publication_sources_assign_version
  on public.library_publication_sources;
create trigger library_publication_sources_assign_version
before insert on public.library_publication_sources
for each row execute function public.library_assign_active_publication_version();

drop trigger if exists library_publication_sections_assign_version
  on public.library_publication_sections;
create trigger library_publication_sections_assign_version
before insert on public.library_publication_sections
for each row execute function public.library_assign_section_source_version();

-- Member passage-level state/provenance is explicitly bound to the active text version.
-- Member Library membership itself remains publication-level by design.
alter table public.library_reading_progress add column if not exists version_id uuid;
alter table public.library_highlights add column if not exists version_id uuid;
alter table public.library_notes add column if not exists version_id uuid;
alter table public.library_bookmarks add column if not exists version_id uuid;
alter table public.library_research_items add column if not exists version_id uuid;
alter table public.library_passage_discussions add column if not exists version_id uuid;

update public.library_reading_progress x set version_id = p.active_version_id
from public.library_publications p where p.id = x.publication_id and x.version_id is null;
update public.library_highlights x set version_id = p.active_version_id
from public.library_publications p where p.id = x.publication_id and x.version_id is null;
update public.library_notes x set version_id = p.active_version_id
from public.library_publications p where p.id = x.publication_id and x.version_id is null;
update public.library_bookmarks x set version_id = p.active_version_id
from public.library_publications p where p.id = x.publication_id and x.version_id is null;
update public.library_research_items x set version_id = p.active_version_id
from public.library_publications p where p.id = x.publication_id and x.version_id is null;
update public.library_passage_discussions x set version_id = p.active_version_id
from public.library_publications p where p.id = x.publication_id and x.version_id is null;

alter table public.library_reading_progress alter column version_id set not null;
alter table public.library_highlights alter column version_id set not null;
alter table public.library_notes alter column version_id set not null;
alter table public.library_bookmarks alter column version_id set not null;
alter table public.library_research_items alter column version_id set not null;
alter table public.library_passage_discussions alter column version_id set not null;

alter table public.library_reading_progress
  add constraint library_reading_progress_version_publication_fkey
  foreign key (version_id, publication_id)
  references public.library_publication_versions(id, publication_id) on delete restrict;
alter table public.library_highlights
  add constraint library_highlights_version_publication_fkey
  foreign key (version_id, publication_id)
  references public.library_publication_versions(id, publication_id) on delete restrict;
alter table public.library_notes
  add constraint library_notes_version_publication_fkey
  foreign key (version_id, publication_id)
  references public.library_publication_versions(id, publication_id) on delete restrict;
alter table public.library_bookmarks
  add constraint library_bookmarks_version_publication_fkey
  foreign key (version_id, publication_id)
  references public.library_publication_versions(id, publication_id) on delete restrict;
alter table public.library_research_items
  add constraint library_research_items_version_publication_fkey
  foreign key (version_id, publication_id)
  references public.library_publication_versions(id, publication_id) on delete restrict;
alter table public.library_passage_discussions
  add constraint library_passage_discussions_version_publication_fkey
  foreign key (version_id, publication_id)
  references public.library_publication_versions(id, publication_id) on delete restrict;

-- A note attached to a highlight must inherit the same publication version.
alter table public.library_highlights
  add constraint library_highlights_identity_version_unique
  unique (id, publication_id, version_id);
alter table public.library_notes
  add constraint library_notes_highlight_version_fkey
  foreign key (highlight_id, publication_id, version_id)
  references public.library_highlights(id, publication_id, version_id)
  on delete cascade;

-- Existing clients do not send version_id yet. Fill it from active_version_id before existing
-- RLS checks/constraints execute. Explicit future revision IDs are preserved unchanged.
drop trigger if exists library_reading_progress_assign_version on public.library_reading_progress;
create trigger library_reading_progress_assign_version before insert on public.library_reading_progress
for each row execute function public.library_assign_active_publication_version();
drop trigger if exists library_highlights_assign_version on public.library_highlights;
create trigger library_highlights_assign_version before insert on public.library_highlights
for each row execute function public.library_assign_active_publication_version();
drop trigger if exists library_notes_assign_version on public.library_notes;
create trigger library_notes_assign_version before insert on public.library_notes
for each row execute function public.library_assign_active_publication_version();
drop trigger if exists library_bookmarks_assign_version on public.library_bookmarks;
create trigger library_bookmarks_assign_version before insert on public.library_bookmarks
for each row execute function public.library_assign_active_publication_version();
drop trigger if exists library_research_items_assign_version on public.library_research_items;
create trigger library_research_items_assign_version before insert on public.library_research_items
for each row execute function public.library_assign_active_publication_version();
drop trigger if exists library_passage_discussions_assign_version on public.library_passage_discussions;
create trigger library_passage_discussions_assign_version before insert on public.library_passage_discussions
for each row execute function public.library_assign_active_publication_version();

create index if not exists library_highlights_user_version_idx
  on public.library_highlights(user_id, version_id, created_at desc);
create index if not exists library_bookmarks_user_version_idx
  on public.library_bookmarks(user_id, version_id, created_at desc);
create index if not exists library_research_items_user_version_idx
  on public.library_research_items(user_id, version_id, created_at desc);
create index if not exists library_passage_discussions_user_version_idx
  on public.library_passage_discussions(user_id, version_id, created_at desc);

-- Public Reader normalized content must come only from the active published version. This is
-- future-safe: staging Version 2 under an already-published canonical publication cannot leak it.
drop policy if exists library_publication_sections_authenticated_read
  on public.library_publication_sections;
create policy library_publication_sections_authenticated_read
  on public.library_publication_sections
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.library_publications p
      where p.id = library_publication_sections.publication_id
        and p.status = 'published'
        and p.active_version_id = library_publication_sections.version_id
    )
  );

comment on table public.library_publication_versions is
  'Version ledger beneath one canonical Library publication identity. Published/superseded snapshots are immutable.';
comment on column public.library_publications.active_version_id is
  'Exact publication version currently served by the canonical Reader when status is published.';
comment on column public.library_publication_sections.version_id is
  'Immutable publication-version identity for this normalized section set.';
comment on column public.library_research_items.version_id is
  'Exact publication version from which this saved research passage originated.';
comment on column public.library_passage_discussions.version_id is
  'Exact publication version from which this discussion passage provenance originated.';
