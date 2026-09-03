-- Library → Book → Book Club Hub → Club Sessions/Groups
-- A publication owns exactly one canonical hub. Sessions/groups live beneath it.

create table if not exists public.library_book_club_hubs (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null unique references public.library_publications(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.library_book_club_sessions (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references public.library_book_club_hubs(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text null check (description is null or char_length(description) <= 1200),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'active' check (status in ('upcoming', 'active', 'completed')),
  room_id uuid null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  check (visibility = 'private' or room_id is null)
);

create unique index if not exists library_book_club_one_active_public_session
  on public.library_book_club_sessions (hub_id)
  where visibility = 'public' and status = 'active';

create index if not exists library_book_club_sessions_hub_idx
  on public.library_book_club_sessions (hub_id, status, created_at desc);

create table if not exists public.library_book_club_members (
  session_id uuid not null references public.library_book_club_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('host', 'member')),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists library_book_club_members_user_idx
  on public.library_book_club_members (user_id, joined_at desc);

create or replace function public.ensure_library_book_club_hub()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'published' then
    insert into public.library_book_club_hubs (publication_id)
    values (new.id)
    on conflict (publication_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists library_publications_ensure_book_club_hub on public.library_publications;
create trigger library_publications_ensure_book_club_hub
after insert or update of status on public.library_publications
for each row execute function public.ensure_library_book_club_hub();

insert into public.library_book_club_hubs (publication_id)
select id from public.library_publications where status = 'published'
on conflict (publication_id) do nothing;

create or replace function public.library_book_club_can_view_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.library_book_club_sessions s
    where s.id = p_session_id
      and (
        s.visibility = 'public'
        or s.created_by = auth.uid()
        or exists (
          select 1 from public.library_book_club_members m
          where m.session_id = s.id and m.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.library_book_club_add_host_membership()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.library_book_club_members (session_id, user_id, role)
  values (new.id, new.created_by, 'host')
  on conflict (session_id, user_id) do update set role = 'host';
  return new;
end;
$$;

drop trigger if exists library_book_club_session_add_host on public.library_book_club_sessions;
create trigger library_book_club_session_add_host
after insert on public.library_book_club_sessions
for each row execute function public.library_book_club_add_host_membership();

alter table public.library_book_club_hubs enable row level security;
alter table public.library_book_club_sessions enable row level security;
alter table public.library_book_club_members enable row level security;

drop policy if exists "Published book club hubs are readable" on public.library_book_club_hubs;
create policy "Published book club hubs are readable"
on public.library_book_club_hubs for select
using (exists (
  select 1 from public.library_publications p
  where p.id = publication_id and p.status = 'published'
));

drop policy if exists "Visible book club sessions are readable" on public.library_book_club_sessions;
create policy "Visible book club sessions are readable"
on public.library_book_club_sessions for select
using (public.library_book_club_can_view_session(id));

drop policy if exists "Authenticated members may start sessions" on public.library_book_club_sessions;
create policy "Authenticated members may start sessions"
on public.library_book_club_sessions for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.library_book_club_hubs h
    join public.library_publications p on p.id = h.publication_id
    where h.id = hub_id and p.status = 'published'
  )
);

drop policy if exists "Session hosts may update sessions" on public.library_book_club_sessions;
create policy "Session hosts may update sessions"
on public.library_book_club_sessions for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "Session hosts may delete sessions" on public.library_book_club_sessions;
create policy "Session hosts may delete sessions"
on public.library_book_club_sessions for delete
to authenticated
using (created_by = auth.uid());

drop policy if exists "Visible session memberships are readable" on public.library_book_club_members;
create policy "Visible session memberships are readable"
on public.library_book_club_members for select
using (public.library_book_club_can_view_session(session_id));

drop policy if exists "Members may join visible sessions" on public.library_book_club_members;
create policy "Members may join visible sessions"
on public.library_book_club_members for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'member'
  and public.library_book_club_can_view_session(session_id)
);

drop policy if exists "Members may leave sessions" on public.library_book_club_members;
create policy "Members may leave sessions"
on public.library_book_club_members for delete
to authenticated
using (user_id = auth.uid() and role = 'member');

grant select on public.library_book_club_hubs to anon, authenticated;
grant select, insert, update, delete on public.library_book_club_sessions to authenticated;
grant select on public.library_book_club_sessions to anon;
grant select, insert, delete on public.library_book_club_members to authenticated;
grant select on public.library_book_club_members to anon;
grant execute on function public.library_book_club_can_view_session(uuid) to anon, authenticated;
