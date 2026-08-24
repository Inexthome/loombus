-- Loombus Library reading lifecycle foundation.
-- Separates saved-library membership from reading intent/state.
-- Scope: Want to Read, Reading, Finished, private owner-scoped state only.

create table if not exists public.library_reading_lifecycle (
  user_id uuid not null references auth.users(id) on delete cascade,
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  state text not null default 'want_to_read' check (state in ('want_to_read','reading','finished')),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, publication_id),
  constraint library_reading_lifecycle_finished_at_check check (
    (state = 'finished' and finished_at is not null)
    or (state <> 'finished' and finished_at is null)
  )
);

create index if not exists library_reading_lifecycle_user_state_idx
  on public.library_reading_lifecycle(user_id, state, updated_at desc);

alter table public.library_reading_lifecycle enable row level security;

-- Lifecycle state is private to its owner.
drop policy if exists "members read own reading lifecycle" on public.library_reading_lifecycle;
create policy "members read own reading lifecycle"
on public.library_reading_lifecycle for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "members create own reading lifecycle" on public.library_reading_lifecycle;
create policy "members create own reading lifecycle"
on public.library_reading_lifecycle for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "members update own reading lifecycle" on public.library_reading_lifecycle;
create policy "members update own reading lifecycle"
on public.library_reading_lifecycle for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "members delete own reading lifecycle" on public.library_reading_lifecycle;
create policy "members delete own reading lifecycle"
on public.library_reading_lifecycle for delete
to authenticated
using (auth.uid() = user_id);

revoke all on table public.library_reading_lifecycle from anon;
grant select, insert, update, delete on table public.library_reading_lifecycle to authenticated;

-- Preserve existing behavior while assigning an explicit lifecycle to current users.
-- Saved items default to Want to Read unless reading progress already establishes a stronger state.
insert into public.library_reading_lifecycle (user_id, publication_id, state, finished_at, created_at, updated_at)
select
  item.user_id,
  item.publication_id,
  case
    when coalesce(progress.progress_percent, 0) >= 100 then 'finished'
    when coalesce(progress.progress_percent, 0) > 0 then 'reading'
    else 'want_to_read'
  end,
  case when coalesce(progress.progress_percent, 0) >= 100 then coalesce(progress.updated_at, progress.last_read_at, item.added_at) else null end,
  item.added_at,
  coalesce(progress.updated_at, progress.last_read_at, item.added_at)
from public.library_member_items item
left join public.library_reading_progress progress
  on progress.user_id = item.user_id
 and progress.publication_id = item.publication_id
on conflict (user_id, publication_id) do nothing;

-- Reading history can exist without an explicit saved-library row; preserve it too.
insert into public.library_reading_lifecycle (user_id, publication_id, state, finished_at, created_at, updated_at)
select
  progress.user_id,
  progress.publication_id,
  case when progress.progress_percent >= 100 then 'finished' else 'reading' end,
  case when progress.progress_percent >= 100 then coalesce(progress.updated_at, progress.last_read_at) else null end,
  progress.created_at,
  coalesce(progress.updated_at, progress.last_read_at)
from public.library_reading_progress progress
where progress.progress_percent > 0
on conflict (user_id, publication_id) do update
set
  state = excluded.state,
  finished_at = excluded.finished_at,
  updated_at = excluded.updated_at
where public.library_reading_lifecycle.state = 'want_to_read';

-- Progress is the authoritative signal for automatic lifecycle movement.
-- Entering the final normalized section produces 100% progress and marks Finished.
-- Any later progress write below 100% means the member resumed reading and clears Finished.
create or replace function public.sync_library_reading_lifecycle_from_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.progress_percent <= 0 then
    return new;
  end if;

  insert into public.library_reading_lifecycle (
    user_id,
    publication_id,
    state,
    finished_at,
    created_at,
    updated_at
  )
  values (
    new.user_id,
    new.publication_id,
    case when new.progress_percent >= 100 then 'finished' else 'reading' end,
    case when new.progress_percent >= 100 then coalesce(new.updated_at, new.last_read_at, now()) else null end,
    coalesce(new.created_at, now()),
    coalesce(new.updated_at, new.last_read_at, now())
  )
  on conflict (user_id, publication_id) do update
  set
    state = excluded.state,
    finished_at = excluded.finished_at,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all on function public.sync_library_reading_lifecycle_from_progress() from public;

drop trigger if exists sync_library_reading_lifecycle_from_progress on public.library_reading_progress;
create trigger sync_library_reading_lifecycle_from_progress
after insert or update of locator, progress_percent, last_read_at, updated_at
on public.library_reading_progress
for each row
execute function public.sync_library_reading_lifecycle_from_progress();
