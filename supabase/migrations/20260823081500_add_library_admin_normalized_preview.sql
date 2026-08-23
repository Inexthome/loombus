-- Allow authenticated Loombus admins to inspect normalized Library sections
-- during editorial review without exposing original EPUB objects or bypassing
-- the existing author/published Reader policies.

drop policy if exists "admins read normalized publication sections"
  on public.library_publication_sections;

create policy "admins read normalized publication sections"
  on public.library_publication_sections
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.profiles p
       where p.id = auth.uid()
         and p.is_admin is true
    )
  );

comment on policy "admins read normalized publication sections"
  on public.library_publication_sections is
  'Allows authenticated Loombus admins to inspect normalized section text for editorial review. Original EPUB Storage access is unchanged.';
