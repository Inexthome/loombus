-- Tighten same-publication version identity and preserve existing never-published hard delete.

alter table public.library_publications
  drop constraint if exists library_publications_active_version_fkey;
alter table public.library_publications
  add constraint library_publications_active_version_fkey
  foreign key (active_version_id, id)
  references public.library_publication_versions(id, publication_id)
  on delete restrict;

alter table public.library_publication_sources
  drop constraint if exists library_publication_sources_version_publication_fkey;
alter table public.library_publication_sources
  add constraint library_publication_sources_version_publication_fkey
  foreign key (version_id, publication_id)
  references public.library_publication_versions(id, publication_id)
  on delete cascade;

alter table public.library_publication_sections
  drop constraint if exists library_publication_sections_version_publication_fkey;
alter table public.library_publication_sections
  add constraint library_publication_sections_version_publication_fkey
  foreign key (version_id, publication_id)
  references public.library_publication_versions(id, publication_id)
  on delete cascade;
