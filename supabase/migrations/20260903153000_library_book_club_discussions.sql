-- Keep Book Club conversation inside the Book Club session.
-- Public/global discussions remain a separate, explicit publishing action.

create or replace function public.library_book_club_is_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.library_book_club_members m
    where m.session_id = p_session_id
      and m.user_id = auth.uid()
  );
$$;

create table if not exists public.library_book_club_discussion_posts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.library_book_club_sessions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid null references public.library_book_club_discussion_posts(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists library_book_club_discussion_posts_session_idx
  on public.library_book_club_discussion_posts (session_id, created_at asc);
create index if not exists library_book_club_discussion_posts_parent_idx
  on public.library_book_club_discussion_posts (parent_id, created_at asc)
  where parent_id is not null;

create or replace function public.library_book_club_validate_discussion_parent()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  parent_session uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select session_id into parent_session
  from public.library_book_club_discussion_posts
  where id = new.parent_id;

  if parent_session is null or parent_session <> new.session_id then
    raise exception 'Book Club reply must belong to the same session';
  end if;

  return new;
end;
$$;

drop trigger if exists library_book_club_discussion_parent_guard on public.library_book_club_discussion_posts;
create trigger library_book_club_discussion_parent_guard
before insert or update of parent_id, session_id on public.library_book_club_discussion_posts
for each row execute function public.library_book_club_validate_discussion_parent();

alter table public.library_book_club_discussion_posts enable row level security;

drop policy if exists "Book Club members may read session discussion" on public.library_book_club_discussion_posts;
create policy "Book Club members may read session discussion"
on public.library_book_club_discussion_posts for select
to authenticated
using (public.library_book_club_is_member(session_id));

drop policy if exists "Book Club members may create session discussion" on public.library_book_club_discussion_posts;
create policy "Book Club members may create session discussion"
on public.library_book_club_discussion_posts for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.library_book_club_is_member(session_id)
);

drop policy if exists "Authors may edit Book Club discussion" on public.library_book_club_discussion_posts;
create policy "Authors may edit Book Club discussion"
on public.library_book_club_discussion_posts for update
to authenticated
using (author_id = auth.uid() and public.library_book_club_is_member(session_id))
with check (author_id = auth.uid() and public.library_book_club_is_member(session_id));

drop policy if exists "Authors may delete Book Club discussion" on public.library_book_club_discussion_posts;
create policy "Authors may delete Book Club discussion"
on public.library_book_club_discussion_posts for delete
to authenticated
using (author_id = auth.uid() and public.library_book_club_is_member(session_id));

-- Raw membership rows should not be exposed anonymously. Session discovery stays public,
-- but membership details and Book Club conversation are authenticated/member-scoped.
revoke select on public.library_book_club_members from anon;

grant select, insert, update, delete on public.library_book_club_discussion_posts to authenticated;
grant execute on function public.library_book_club_is_member(uuid) to authenticated;
