-- Repair Loombus Library note-to-highlight publication binding.
-- The original policy used an unqualified outer publication_id reference inside the
-- highlight subquery, allowing PostgreSQL name resolution to bind both sides to the
-- highlight row. Qualify the outer library_notes columns explicitly.

drop policy if exists "members create own notes" on public.library_notes;
create policy "members create own notes"
on public.library_notes
for insert
to authenticated
with check (
  auth.uid() = library_notes.user_id
  and (
    library_notes.highlight_id is null
    or exists (
      select 1
      from public.library_highlights h
      where h.id = library_notes.highlight_id
        and h.user_id = auth.uid()
        and h.publication_id = library_notes.publication_id
    )
  )
);

drop policy if exists "members update own notes" on public.library_notes;
create policy "members update own notes"
on public.library_notes
for update
to authenticated
using (auth.uid() = library_notes.user_id)
with check (
  auth.uid() = library_notes.user_id
  and (
    library_notes.highlight_id is null
    or exists (
      select 1
      from public.library_highlights h
      where h.id = library_notes.highlight_id
        and h.user_id = auth.uid()
        and h.publication_id = library_notes.publication_id
    )
  )
);
