begin;

create table if not exists public.floor_cloud_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('watch', 'journal', 'workspace_draft', 'workspace_revision', 'academy_progress', 'session')),
  client_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, kind, client_id)
);

create index if not exists floor_cloud_items_owner_kind_idx
  on public.floor_cloud_items (owner_id, kind, updated_at desc);

create table if not exists public.floor_research_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  focus text not null default '',
  objective text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'unlisted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.floor_room_members (
  room_id uuid not null references public.floor_research_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'analyst', 'reviewer', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists floor_room_members_user_idx
  on public.floor_room_members (user_id, room_id);

create table if not exists public.floor_room_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.floor_research_rooms(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('evidence', 'task', 'note', 'thesis', 'review', 'session', 'replay')),
  title text not null check (char_length(title) between 1 and 180),
  content jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'in_review', 'approved', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists floor_room_items_room_idx
  on public.floor_room_items (room_id, created_at desc);

create or replace function public.floor_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists floor_cloud_items_touch on public.floor_cloud_items;
create trigger floor_cloud_items_touch before update on public.floor_cloud_items
for each row execute function public.floor_touch_updated_at();

drop trigger if exists floor_research_rooms_touch on public.floor_research_rooms;
create trigger floor_research_rooms_touch before update on public.floor_research_rooms
for each row execute function public.floor_touch_updated_at();

drop trigger if exists floor_room_items_touch on public.floor_room_items;
create trigger floor_room_items_touch before update on public.floor_room_items
for each row execute function public.floor_touch_updated_at();

create or replace function public.floor_room_role(target_room uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.floor_room_members
  where room_id = target_room and user_id = auth.uid()
  limit 1
$$;

revoke all on function public.floor_room_role(uuid) from public;
grant execute on function public.floor_room_role(uuid) to authenticated;

create or replace function public.floor_seed_room_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.floor_room_members (room_id, user_id, role, invited_by)
  values (new.id, new.owner_id, 'owner', new.owner_id)
  on conflict (room_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists floor_research_rooms_seed_owner on public.floor_research_rooms;
create trigger floor_research_rooms_seed_owner
after insert on public.floor_research_rooms
for each row execute function public.floor_seed_room_owner();

alter table public.floor_cloud_items enable row level security;
alter table public.floor_research_rooms enable row level security;
alter table public.floor_room_members enable row level security;
alter table public.floor_room_items enable row level security;

drop policy if exists "floor cloud items owner select" on public.floor_cloud_items;
create policy "floor cloud items owner select" on public.floor_cloud_items
for select using (owner_id = auth.uid());
drop policy if exists "floor cloud items owner insert" on public.floor_cloud_items;
create policy "floor cloud items owner insert" on public.floor_cloud_items
for insert with check (owner_id = auth.uid());
drop policy if exists "floor cloud items owner update" on public.floor_cloud_items;
create policy "floor cloud items owner update" on public.floor_cloud_items
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "floor cloud items owner delete" on public.floor_cloud_items;
create policy "floor cloud items owner delete" on public.floor_cloud_items
for delete using (owner_id = auth.uid());

drop policy if exists "floor rooms member select" on public.floor_research_rooms;
create policy "floor rooms member select" on public.floor_research_rooms
for select using (owner_id = auth.uid() or public.floor_room_role(id) is not null);
drop policy if exists "floor rooms owner insert" on public.floor_research_rooms;
create policy "floor rooms owner insert" on public.floor_research_rooms
for insert with check (owner_id = auth.uid());
drop policy if exists "floor rooms manager update" on public.floor_research_rooms;
create policy "floor rooms manager update" on public.floor_research_rooms
for update using (owner_id = auth.uid() or public.floor_room_role(id) in ('owner', 'admin'))
with check (owner_id = auth.uid() or public.floor_room_role(id) in ('owner', 'admin'));
drop policy if exists "floor rooms owner delete" on public.floor_research_rooms;
create policy "floor rooms owner delete" on public.floor_research_rooms
for delete using (owner_id = auth.uid());

drop policy if exists "floor room members member select" on public.floor_room_members;
create policy "floor room members member select" on public.floor_room_members
for select using (public.floor_room_role(room_id) is not null);
drop policy if exists "floor room members manager insert" on public.floor_room_members;
create policy "floor room members manager insert" on public.floor_room_members
for insert with check (public.floor_room_role(room_id) in ('owner', 'admin'));
drop policy if exists "floor room members manager update" on public.floor_room_members;
create policy "floor room members manager update" on public.floor_room_members
for update using (public.floor_room_role(room_id) in ('owner', 'admin'))
with check (public.floor_room_role(room_id) in ('owner', 'admin'));
drop policy if exists "floor room members manager delete" on public.floor_room_members;
create policy "floor room members manager delete" on public.floor_room_members
for delete using (
  public.floor_room_role(room_id) in ('owner', 'admin')
  and not (user_id = auth.uid() and role = 'owner')
);

drop policy if exists "floor room items member select" on public.floor_room_items;
create policy "floor room items member select" on public.floor_room_items
for select using (public.floor_room_role(room_id) is not null);
drop policy if exists "floor room items contributor insert" on public.floor_room_items;
create policy "floor room items contributor insert" on public.floor_room_items
for insert with check (
  author_id = auth.uid()
  and public.floor_room_role(room_id) in ('owner', 'admin', 'analyst', 'reviewer')
);
drop policy if exists "floor room items author update" on public.floor_room_items;
create policy "floor room items author update" on public.floor_room_items
for update using (
  author_id = auth.uid() or public.floor_room_role(room_id) in ('owner', 'admin', 'reviewer')
)
with check (public.floor_room_role(room_id) is not null);
drop policy if exists "floor room items author delete" on public.floor_room_items;
create policy "floor room items author delete" on public.floor_room_items
for delete using (author_id = auth.uid() or public.floor_room_role(room_id) in ('owner', 'admin'));

grant select, insert, update, delete on public.floor_cloud_items to authenticated;
grant select, insert, update, delete on public.floor_research_rooms to authenticated;
grant select, insert, update, delete on public.floor_room_members to authenticated;
grant select, insert, update, delete on public.floor_room_items to authenticated;

commit;
