-- Repair Library note/highlight binding so a note may only reference a highlight
-- owned by the same authenticated member and belonging to the same publication.

create or replace function public.library_note_highlight_binding_valid(
  p_user_id uuid,
  p_publication_id uuid,
  p_highlight_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_highlight_id is null
    or exists (
      select 1
      from public.library_highlights h
      where h.id = p_highlight_id
        and h.user_id = p_user_id
        and h.publication_id = p_publication_id
    );
$$;

revoke all on function public.library_note_highlight_binding_valid(uuid, uuid, uuid) from public;
grant execute on function public.library_note_highlight_binding_valid(uuid, uuid, uuid) to authenticated;

drop policy if exists "members create own notes" on public.library_notes;
create policy "members create own notes"
on public.library_notes
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.library_note_highlight_binding_valid(user_id, publication_id, highlight_id)
);

drop policy if exists "members update own notes" on public.library_notes;
create policy "members update own notes"
on public.library_notes
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and public.library_note_highlight_binding_valid(user_id, publication_id, highlight_id)
);
