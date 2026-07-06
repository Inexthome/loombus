create table if not exists public.room_join_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_contact text not null default '' check (char_length(requester_contact) <= 200),
  requester_note text not null default '' check (char_length(requester_note) <= 4000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  invited_email text not null default '' check (char_length(invited_email) <= 320),
  invited_user_id uuid references auth.users(id) on delete cascade,
  invite_note text not null default '' check (char_length(invite_note) <= 4000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists room_join_requests_room_status_idx on public.room_join_requests (room_id, status);
create index if not exists room_join_requests_requester_idx on public.room_join_requests (requester_user_id);
create unique index if not exists room_join_requests_one_pending_idx on public.room_join_requests (room_id, requester_user_id) where status = 'pending';

create index if not exists room_invites_room_status_idx on public.room_invites (room_id, status);
create index if not exists room_invites_invited_user_idx on public.room_invites (invited_user_id);
create index if not exists room_invites_invited_email_idx on public.room_invites (lower(invited_email));

alter table public.room_join_requests enable row level security;
alter table public.room_invites enable row level security;

create or replace function public.user_can_manage_room_entry(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = 'public'
as $function$
  select
    exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
        and member.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.rooms room
      where room.id = target_room_id
        and (room.owner_id = auth.uid() or room.created_by = auth.uid())
    );
$function$;

create or replace function public.user_can_request_join_room(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = 'public'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.room_preferences preferences
      where preferences.room_id = target_room_id
        and preferences.room_status = 'active'
        and preferences.join_rule = 'request_to_join'
    )
    and not exists (
      select 1
      from public.room_members member
      where member.room_id = target_room_id
        and member.user_id = auth.uid()
    );
$function$;

drop policy if exists "Room entry managers can view join requests" on public.room_join_requests;
create policy "Room entry managers can view join requests"
  on public.room_join_requests
  for select
  using (public.user_can_manage_room_entry(room_id) or requester_user_id = auth.uid());

drop policy if exists "Signed in users can request room entry" on public.room_join_requests;
create policy "Signed in users can request room entry"
  on public.room_join_requests
  for insert
  with check (
    requester_user_id = auth.uid()
    and status = 'pending'
    and public.user_can_request_join_room(room_id)
  );

drop policy if exists "Room entry managers can update join requests" on public.room_join_requests;
create policy "Room entry managers can update join requests"
  on public.room_join_requests
  for update
  using (public.user_can_manage_room_entry(room_id) or requester_user_id = auth.uid())
  with check (
    public.user_can_manage_room_entry(room_id)
    or (
      requester_user_id = auth.uid()
      and status = 'cancelled'
    )
  );

drop policy if exists "Room entry managers can view invites" on public.room_invites;
create policy "Room entry managers can view invites"
  on public.room_invites
  for select
  using (
    public.user_can_manage_room_entry(room_id)
    or invited_user_id = auth.uid()
    or lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

drop policy if exists "Room entry managers can create invites" on public.room_invites;
create policy "Room entry managers can create invites"
  on public.room_invites
  for insert
  with check (
    invited_by = auth.uid()
    and status = 'pending'
    and public.user_can_manage_room_entry(room_id)
  );

drop policy if exists "Room entry managers can update invites" on public.room_invites;
create policy "Room entry managers can update invites"
  on public.room_invites
  for update
  using (
    public.user_can_manage_room_entry(room_id)
    or invited_user_id = auth.uid()
    or lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  with check (
    public.user_can_manage_room_entry(room_id)
    or (
      status = 'accepted'
      and (
        invited_user_id = auth.uid()
        or lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
    )
  );
