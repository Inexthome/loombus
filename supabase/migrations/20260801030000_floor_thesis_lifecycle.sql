begin;
alter table public.floor_theses add column if not exists lifecycle_status text not null default 'active' check (lifecycle_status in ('active','withdrawn','deleted'));
alter table public.floor_theses add column if not exists updated_at timestamptz not null default now();
alter table public.floor_theses add column if not exists withdrawn_at timestamptz;
alter table public.floor_theses add column if not exists deleted_at timestamptz;

create table if not exists public.floor_thesis_revisions (
 id uuid primary key default gen_random_uuid(),
 thesis_id uuid not null references public.floor_theses(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 snapshot jsonb not null,
 change_type text not null check (change_type in ('edit','withdraw','restore','delete')),
 created_at timestamptz not null default now()
);
create index if not exists floor_thesis_revisions_thesis_idx on public.floor_thesis_revisions(thesis_id,created_at desc);
alter table public.floor_thesis_revisions enable row level security;
drop policy if exists "thesis authors read revisions" on public.floor_thesis_revisions;
create policy "thesis authors read revisions" on public.floor_thesis_revisions for select using(author_id=auth.uid());
drop policy if exists "thesis authors add revisions" on public.floor_thesis_revisions;
create policy "thesis authors add revisions" on public.floor_thesis_revisions for insert with check(author_id=auth.uid());
grant select,insert on public.floor_thesis_revisions to authenticated;

drop policy if exists "thesis authors update own" on public.floor_theses;
create policy "thesis authors update own" on public.floor_theses for update using(author_id=auth.uid()) with check(author_id=auth.uid());
commit;