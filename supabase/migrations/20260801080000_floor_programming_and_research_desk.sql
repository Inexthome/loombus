begin;

create table if not exists public.floor_live_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 160),
  format text not null check (format in ('opening_bell', 'research_room', 'earnings_debrief', 'office_hours', 'workshop')),
  description text not null default '',
  focus text not null default '',
  starts_at timestamptz not null,
  duration_minutes integer not null default 45 check (duration_minutes between 15 and 240),
  host_id uuid not null references public.profiles(id) on delete restrict,
  meeting_url text,
  replay_url text,
  replay_summary text,
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'live', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.floor_live_registrations (
  program_id uuid not null references public.floor_live_programs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_minutes integer not null default 30 check (reminder_minutes in (0, 15, 30, 60, 1440)),
  registered_at timestamptz not null default now(),
  attended_at timestamptz,
  primary key (program_id, user_id)
);

create table if not exists public.floor_research_publications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  publication_type text not null check (publication_type in ('daily_briefing', 'weekly_outlook', 'earnings_preview', 'earnings_review', 'company_dossier', 'sector_watch', 'bull_bear', 'what_changed', 'monthly_accountability')),
  title text not null check (char_length(trim(title)) between 3 and 180),
  excerpt text not null default '',
  body text not null default '',
  tickers text[] not null default '{}',
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array'),
  author_id uuid not null references public.profiles(id) on delete restrict,
  reviewer_id uuid references public.profiles(id) on delete restrict,
  ai_assisted boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reviewer_id is null or reviewer_id <> author_id),
  check (status <> 'published' or (published_at is not null and reviewer_id is not null and body <> ''))
);

create table if not exists public.floor_contributor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'applicant' check (status in ('applicant', 'active', 'paused', 'declined')),
  specialties text[] not null default '{}',
  disclosure text not null default '',
  target_cadence text not null default 'weekly' check (target_cadence in ('weekly', 'biweekly', 'monthly')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.floor_contributor_assignments (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.floor_contributor_profiles(user_id) on delete cascade,
  title text not null,
  focus text not null default '',
  due_at timestamptz not null,
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'submitted', 'published', 'missed', 'cancelled')),
  publication_id uuid references public.floor_research_publications(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.floor_academy_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index if not exists floor_live_programs_schedule_idx on public.floor_live_programs (status, starts_at);
create index if not exists floor_research_publications_feed_idx on public.floor_research_publications (status, published_at desc);
create index if not exists floor_contributor_assignments_due_idx on public.floor_contributor_assignments (contributor_id, due_at);

alter table public.floor_live_programs enable row level security;
alter table public.floor_live_registrations enable row level security;
alter table public.floor_research_publications enable row level security;
alter table public.floor_contributor_profiles enable row level security;
alter table public.floor_contributor_assignments enable row level security;
alter table public.floor_academy_progress enable row level security;

create policy "Members read scheduled Floor programming" on public.floor_live_programs for select to authenticated
  using (status in ('scheduled', 'live', 'completed') or host_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "Admins manage Floor programming" on public.floor_live_programs for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Members manage own live registrations" on public.floor_live_registrations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Hosts read program registrations" on public.floor_live_registrations for select to authenticated
  using (exists (select 1 from public.floor_live_programs p where p.id = program_id and (p.host_id = auth.uid() or exists (select 1 from public.profiles a where a.id = auth.uid() and a.is_admin))));

create policy "Members read reviewed Floor research" on public.floor_research_publications for select to authenticated
  using (status = 'published' or author_id = auth.uid() or reviewer_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "Admins manage Floor research" on public.floor_research_publications for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Members manage own contributor application" on public.floor_contributor_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "Members read own contributor profile" on public.floor_contributor_profiles for select to authenticated
  using (user_id = auth.uid() or status = 'active' or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "Members update own contributor disclosures" on public.floor_contributor_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admins manage contributor profiles" on public.floor_contributor_profiles for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create or replace function public.protect_floor_contributor_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  then
    raise exception 'Contributor status can only be changed by an administrator';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_floor_contributor_status() from public, anon, authenticated;
create trigger protect_floor_contributor_status_trigger before update on public.floor_contributor_profiles
for each row execute function public.protect_floor_contributor_status();

create policy "Contributors read own assignments" on public.floor_contributor_assignments for select to authenticated
  using (contributor_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "Contributors update own assignment status" on public.floor_contributor_assignments for update to authenticated
  using (contributor_id = auth.uid()) with check (contributor_id = auth.uid() and status in ('in_progress', 'submitted'));
create policy "Admins manage contributor assignments" on public.floor_contributor_assignments for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "Members manage own Academy progress" on public.floor_academy_progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.floor_live_programs, public.floor_research_publications to authenticated;
grant select, insert, update, delete on public.floor_live_registrations, public.floor_academy_progress to authenticated;
grant select, insert, update on public.floor_contributor_profiles to authenticated;
grant select, update on public.floor_contributor_assignments to authenticated;
grant all on public.floor_live_programs, public.floor_live_registrations, public.floor_research_publications, public.floor_contributor_profiles, public.floor_contributor_assignments, public.floor_academy_progress to service_role;

comment on table public.floor_research_publications is 'Human-reviewed member research. AI assistance is disclosed and cannot bypass reviewer attribution.';
comment on table public.floor_live_programs is 'Real scheduled Floor programming. Rows require an attributable host; no synthetic attendance or replay records.';

notify pgrst, 'reload schema';
commit;
