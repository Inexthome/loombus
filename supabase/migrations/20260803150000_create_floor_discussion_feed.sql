-- The Floor: discussion feed (posts + replies).
--
-- This is the space members actually talk in -- thesis cards and (later)
-- the weekly AI synthesis sit on top of it, not the other way around.
--
-- Deliberately NOT a fork of room_posts/room_members. There is no
-- platform-wide/"everyone's" Room anywhere in this schema -- every Room is
-- private, invite-only, and owner-provisioned -- so gating The Floor by real
-- Room membership would mean inventing that concept from scratch. Instead
-- this reuses room_posts' proven SHAPE (soft delete via deleted_at/
-- deleted_by/deletion_reason, a reply_count counter, last_activity_at,
-- service-untouched RLS-first writes) while gating access the way every
-- other Floor table already does: public.floor_member_is_eligible(), the
-- same "adult, non-suspended" bar floor_theses and floor_calls use.
--
-- No edit capability, matching room_posts' own precedent (Room discussions
-- have create/delete/resolve actions but no edit action either). No
-- UPDATE/DELETE grant is issued to authenticated or service_role in this
-- migration -- nothing in this PR's application code needs one, and
-- granting privileges nothing uses is exactly the mistake
-- 20260803140000_harden_floor_service_role_privileges.sql just finished
-- cleaning up elsewhere. deleted_at/deleted_by/deletion_reason columns are
-- present so a future moderation PR can add exactly the grant/policy it
-- needs without a schema change.

begin;

create table if not exists public.floor_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  body text not null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_reason text,
  reply_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floor_posts_title_length_check check (
    title is null or char_length(btrim(title)) between 1 and 160
  ),
  constraint floor_posts_body_length_check check (
    char_length(btrim(body)) between 1 and 5000
  ),
  constraint floor_posts_reply_count_check check (reply_count >= 0)
);

create index if not exists floor_posts_live_feed_idx
  on public.floor_posts (last_activity_at desc)
  where deleted_at is null;
create index if not exists floor_posts_author_created_idx
  on public.floor_posts (author_id, created_at desc);

create table if not exists public.floor_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.floor_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint floor_post_replies_body_length_check check (
    char_length(btrim(body)) between 1 and 3000
  )
);

create index if not exists floor_post_replies_post_created_idx
  on public.floor_post_replies (post_id, created_at asc);
create index if not exists floor_post_replies_author_created_idx
  on public.floor_post_replies (author_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

drop trigger if exists touch_floor_posts_updated_at on public.floor_posts;
create trigger touch_floor_posts_updated_at
before update on public.floor_posts
for each row execute function public.touch_floor_updated_at();

drop trigger if exists touch_floor_post_replies_updated_at on public.floor_post_replies;
create trigger touch_floor_post_replies_updated_at
before update on public.floor_post_replies
for each row execute function public.touch_floor_updated_at();

create or replace function public.floor_bump_post_activity_on_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.floor_posts
  set reply_count = reply_count + 1,
      last_activity_at = now()
  where id = new.post_id;

  return new;
end;
$$;

drop trigger if exists floor_bump_post_activity_on_reply_trigger on public.floor_post_replies;
create trigger floor_bump_post_activity_on_reply_trigger
after insert on public.floor_post_replies
for each row execute function public.floor_bump_post_activity_on_reply();

-- ---------------------------------------------------------------------------
-- Helper functions (RLS)
-- ---------------------------------------------------------------------------

create or replace function public.floor_post_is_visible(target_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.floor_posts p
    where p.id = target_post_id
      and (
        p.deleted_at is null
        or p.author_id = auth.uid()
        or exists (
          select 1 from public.profiles pr
          where pr.id = auth.uid() and pr.is_admin
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.floor_posts enable row level security;
alter table public.floor_post_replies enable row level security;

drop policy if exists "Floor posts are visible to eligible members" on public.floor_posts;
create policy "Floor posts are visible to eligible members"
on public.floor_posts for select to authenticated
using (
  deleted_at is null
  or author_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

drop policy if exists "Eligible members can start a Floor discussion" on public.floor_posts;
create policy "Eligible members can start a Floor discussion"
on public.floor_posts for insert to authenticated
with check (
  author_id = auth.uid()
  and public.floor_member_is_eligible()
  and deleted_at is null
  and deleted_by is null
  and reply_count = 0
);

drop policy if exists "Floor post replies are visible with their post" on public.floor_post_replies;
create policy "Floor post replies are visible with their post"
on public.floor_post_replies for select to authenticated
using (
  (deleted_at is null or author_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  and public.floor_post_is_visible(post_id)
);

drop policy if exists "Eligible members can reply to a Floor discussion" on public.floor_post_replies;
create policy "Eligible members can reply to a Floor discussion"
on public.floor_post_replies for insert to authenticated
with check (
  author_id = auth.uid()
  and public.floor_member_is_eligible()
  and deleted_at is null
  and deleted_by is null
  and exists (
    select 1 from public.floor_posts p
    where p.id = post_id and p.deleted_at is null
  )
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on table public.floor_posts from anon;
revoke all on table public.floor_post_replies from anon;

revoke insert, update, delete on table public.floor_posts from authenticated;
grant select, insert on table public.floor_posts to authenticated;

revoke insert, update, delete on table public.floor_post_replies from authenticated;
grant select, insert on table public.floor_post_replies to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter table public.floor_posts replica identity full;
alter table public.floor_post_replies replica identity full;

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'floor_posts',
    'floor_post_replies'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        relation_name
      );
    end if;
  end loop;
end;
$$;

comment on table public.floor_posts is
  'The Floor discussion feed: member-started threads. No edit capability by design (matches room_posts precedent) -- create and soft-delete (future PR) only.';
comment on table public.floor_post_replies is
  'Replies to a floor_posts thread. reply_count/last_activity_at on the parent are maintained by floor_bump_post_activity_on_reply().';

notify pgrst, 'reload schema';

commit;
