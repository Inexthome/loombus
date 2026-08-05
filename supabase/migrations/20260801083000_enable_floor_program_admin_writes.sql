begin;

-- RLS remains the authorization boundary: the existing policies only permit
-- profiles.is_admin members to mutate these editorial and programming tables.
grant insert, update, delete on table public.floor_live_programs to authenticated;
grant insert, update, delete on table public.floor_research_publications to authenticated;
grant insert, update, delete on table public.floor_contributor_assignments to authenticated;
grant delete on table public.floor_contributor_profiles to authenticated;

create or replace function public.touch_floor_program_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_floor_program_updated_at() from public, anon, authenticated;

drop trigger if exists touch_floor_live_programs_updated_at on public.floor_live_programs;
create trigger touch_floor_live_programs_updated_at
before update on public.floor_live_programs
for each row execute function public.touch_floor_program_updated_at();

drop trigger if exists touch_floor_research_publications_updated_at on public.floor_research_publications;
create trigger touch_floor_research_publications_updated_at
before update on public.floor_research_publications
for each row execute function public.touch_floor_program_updated_at();

drop trigger if exists touch_floor_contributor_profiles_updated_at on public.floor_contributor_profiles;
create trigger touch_floor_contributor_profiles_updated_at
before update on public.floor_contributor_profiles
for each row execute function public.touch_floor_program_updated_at();

drop trigger if exists touch_floor_contributor_assignments_updated_at on public.floor_contributor_assignments;
create trigger touch_floor_contributor_assignments_updated_at
before update on public.floor_contributor_assignments
for each row execute function public.touch_floor_program_updated_at();

notify pgrst, 'reload schema';
commit;
