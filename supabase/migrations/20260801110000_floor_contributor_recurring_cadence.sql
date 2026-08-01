begin;

create extension if not exists pg_cron;

alter table public.floor_contributor_assignments
  add column if not exists cadence_generated boolean not null default false,
  add column if not exists cadence_cycle_start date;

create unique index if not exists floor_contributor_assignment_cadence_cycle_idx
  on public.floor_contributor_assignments (contributor_id, cadence_cycle_start)
  where cadence_cycle_start is not null;

create or replace function public.protect_floor_contributor_assignment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean := false;
begin
  if auth.uid() is not null then
    select coalesce(profile.is_admin, false)
      into is_admin
    from public.profiles profile
    where profile.id = auth.uid();
  end if;

  if auth.uid() is null or is_admin then
    return new;
  end if;

  if new.contributor_id is distinct from old.contributor_id
    or new.title is distinct from old.title
    or new.focus is distinct from old.focus
    or new.due_at is distinct from old.due_at
    or new.publication_id is distinct from old.publication_id
    or new.cadence_generated is distinct from old.cadence_generated
    or new.cadence_cycle_start is distinct from old.cadence_cycle_start
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Contributors can only update assignment workflow status.';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'assigned' and new.status in ('in_progress', 'submitted'))
    or (old.status = 'in_progress' and new.status = 'submitted')
  ) then
    raise exception 'Invalid contributor assignment status transition.';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_floor_contributor_assignment_fields_trigger
  on public.floor_contributor_assignments;
create trigger protect_floor_contributor_assignment_fields_trigger
before update on public.floor_contributor_assignments
for each row execute function public.protect_floor_contributor_assignment_fields();

revoke all on function public.protect_floor_contributor_assignment_fields()
  from public, anon, authenticated;

create or replace function public.dispatch_floor_contributor_cadence()
returns table(generated_assignments integer, marked_missed integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  contributor record;
  assignment_id uuid;
  generated_count integer := 0;
  missed_count integer := 0;
  cadence_interval interval;
  assignment_due_at timestamptz;
begin
  update public.floor_contributor_assignments
  set status = 'missed', updated_at = now()
  where status in ('assigned', 'in_progress')
    and due_at < now();
  get diagnostics missed_count = row_count;

  for contributor in
    select
      profile.user_id,
      profile.target_cadence,
      profile.specialties,
      profile.accepted_at
    from public.floor_contributor_profiles profile
    where profile.status = 'active'
      and not exists (
        select 1
        from public.floor_contributor_assignments assignment
        where assignment.contributor_id = profile.user_id
          and assignment.status in ('assigned', 'in_progress', 'submitted')
      )
      and (
        not exists (
          select 1
          from public.floor_contributor_assignments assignment
          where assignment.contributor_id = profile.user_id
        )
        or coalesce(
          (
            select max(assignment.due_at)
            from public.floor_contributor_assignments assignment
            where assignment.contributor_id = profile.user_id
          ),
          profile.accepted_at,
          now()
        ) <= now()
      )
  loop
    cadence_interval := case contributor.target_cadence
      when 'weekly' then interval '7 days'
      when 'biweekly' then interval '14 days'
      else interval '1 month'
    end;
    assignment_due_at := now() + cadence_interval;

    insert into public.floor_contributor_assignments (
      contributor_id,
      title,
      focus,
      due_at,
      status,
      cadence_generated,
      cadence_cycle_start
    )
    values (
      contributor.user_id,
      initcap(contributor.target_cadence) || ' Research Desk contribution',
      case
        when coalesce(cardinality(contributor.specialties), 0) > 0
          then 'Prepare accountable research within: ' || array_to_string(contributor.specialties, ', ')
        else 'Prepare an evidence-backed Research Desk contribution within your disclosed coverage.'
      end,
      assignment_due_at,
      'assigned',
      true,
      current_date
    )
    on conflict (contributor_id, cadence_cycle_start)
      where cadence_cycle_start is not null
    do nothing
    returning id into assignment_id;

    if assignment_id is not null then
      generated_count := generated_count + 1;
      insert into public.notifications (
        user_id,
        actor_id,
        type,
        target_type,
        target_id,
        message
      )
      values (
        contributor.user_id,
        null,
        'floor_contributor_assignment',
        'floor_contributor_assignment',
        assignment_id,
        'Your next ' || contributor.target_cadence ||
          ' Research Desk assignment is due ' ||
          to_char(assignment_due_at at time zone 'America/New_York', 'Mon FMDD at FMHH12:MI AM') || ' ET.'
      );
    end if;

    assignment_id := null;
  end loop;

  return query select generated_count, missed_count;
end;
$$;

revoke all on function public.dispatch_floor_contributor_cadence()
  from public, anon, authenticated;
grant execute on function public.dispatch_floor_contributor_cadence()
  to service_role;

select cron.schedule(
  'floor-contributor-cadence',
  '15 13 * * *',
  $command$select public.dispatch_floor_contributor_cadence();$command$
);

comment on function public.dispatch_floor_contributor_cadence() is
  'Daily contributor cadence dispatcher. Marks overdue work missed and creates the next real assignment only when no open assignment exists.';
comment on column public.floor_contributor_assignments.cadence_generated is
  'True only for assignments created by the recurring Floor cadence dispatcher.';

notify pgrst, 'reload schema';
commit;
