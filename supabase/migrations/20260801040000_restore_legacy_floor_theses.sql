begin;

-- Recover legacy theses when lifecycle_status existed before the full lifecycle migration.
alter table public.floor_theses
  alter column lifecycle_status set default 'active';

update public.floor_theses
set lifecycle_status = 'active',
    updated_at = coalesce(updated_at, created_at, now())
where lifecycle_status is null;

alter table public.floor_theses
  alter column lifecycle_status set not null;

commit;
