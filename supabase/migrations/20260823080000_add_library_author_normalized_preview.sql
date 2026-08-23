-- Author normalized-preview access.
-- Authors may read the normalized sections of their own canonical draft so they
-- can inspect exactly what Loombus produced before review/publication.
-- This does not expand original EPUB access and does not expose drafts to other members.

drop policy if exists "authors preview own normalized library draft sections"
  on public.library_publication_sections;

create policy "authors preview own normalized library draft sections"
  on public.library_publication_sections
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.library_author_publications a
        join public.library_publications p
          on p.id = a.publication_id
       where a.publication_id = library_publication_sections.publication_id
         and a.user_id = auth.uid()
         and a.retired_at is null
         and p.status = 'draft'
    )
  );

comment on policy "authors preview own normalized library draft sections"
  on public.library_publication_sections is
  'Allows an authenticated author to read normalized sections for their own non-retired canonical draft. Published content continues to use the existing member-read policy.';
