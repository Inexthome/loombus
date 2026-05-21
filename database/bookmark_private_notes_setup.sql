-- Bookmark Private Notes setup for Loombus
-- Purpose:
-- - Keep existing saved/bookmark behavior available.
-- - Add a private_note field to existing bookmarks.
-- - Treat private notes as a Premium Plus/Admin feature.
-- - Allow clearing notes for any bookmark owner.
-- - Allow creating/updating non-empty notes only for Premium Plus/Admin users.

alter table if exists public.bookmarks
  add column if not exists private_note text;

alter table if exists public.bookmarks
  add column if not exists private_note_updated_at timestamptz;

alter table if exists public.bookmarks
  drop constraint if exists bookmarks_private_note_length;

alter table if exists public.bookmarks
  add constraint bookmarks_private_note_length
  check (private_note is null or char_length(private_note) <= 1000);

create or replace function public.user_has_bookmark_private_notes_access(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_ai_entitlements entitlement
    where entitlement.user_id = target_user_id
      and (
        entitlement.tier = 'admin'
        or (
          entitlement.ai_assisted_enabled = true
          and entitlement.tier = 'premium'
          and entitlement.monthly_summary_limit > 50
        )
      )
  );
$$;

create or replace function public.ensure_bookmark_private_note_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.private_note, '')), '') is null then
    new.private_note = null;
    new.private_note_updated_at = null;
    return new;
  end if;

  if not public.user_has_bookmark_private_notes_access(new.user_id) then
    raise exception 'Private notes require Premium Plus or Admin access.';
  end if;

  if tg_op = 'INSERT' or old.private_note is distinct from new.private_note then
    new.private_note_updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_bookmark_private_note_access
  on public.bookmarks;

create trigger ensure_bookmark_private_note_access
before insert or update of private_note, user_id on public.bookmarks
for each row
execute function public.ensure_bookmark_private_note_access();

create index if not exists bookmarks_user_private_note_updated_idx
  on public.bookmarks (user_id, private_note_updated_at desc)
  where private_note is not null;
