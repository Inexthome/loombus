-- Teen Safety Mode foundation for Loombus
-- Adds age safety fields to public.profiles and updates the signup profile bootstrap trigger.
-- Policy:
-- - under_13 accounts should be blocked at signup/application layer.
-- - 13-17 accounts are marked teen and teen_safety_mode=true.
-- - 18+ accounts are marked adult.
-- - existing accounts remain unknown until a later DOB collection flow.

alter table public.profiles
add column if not exists date_of_birth date;

alter table public.profiles
add column if not exists age_band text not null default 'unknown';

alter table public.profiles
add column if not exists teen_safety_mode boolean not null default false;

alter table public.profiles
add column if not exists guardian_required boolean not null default false;

alter table public.profiles
drop constraint if exists profiles_age_band_check;

alter table public.profiles
add constraint profiles_age_band_check
check (age_band in ('unknown', 'under_13', 'teen', 'adult'));

create index if not exists profiles_age_band_idx
on public.profiles(age_band);

create index if not exists profiles_teen_safety_mode_idx
on public.profiles(teen_safety_mode)
where teen_safety_mode = true;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_full_name text;
  raw_date_of_birth text;
  clean_date_of_birth date;
  resolved_age_band text := 'unknown';
  resolved_teen_safety_mode boolean := false;
  resolved_guardian_required boolean := false;
  calculated_age integer;
begin
  clean_full_name := nullif(
    trim(
      coalesce(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        ''
      )
    ),
    ''
  );

  raw_date_of_birth := nullif(
    trim(coalesce(new.raw_user_meta_data->>'date_of_birth', '')),
    ''
  );

  if raw_date_of_birth ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    clean_date_of_birth := raw_date_of_birth::date;

    calculated_age := date_part('year', age(current_date, clean_date_of_birth));

    if calculated_age < 13 then
      resolved_age_band := 'under_13';
      resolved_teen_safety_mode := true;
      resolved_guardian_required := true;
    elsif calculated_age < 18 then
      resolved_age_band := 'teen';
      resolved_teen_safety_mode := true;
      resolved_guardian_required := false;
    else
      resolved_age_band := 'adult';
      resolved_teen_safety_mode := false;
      resolved_guardian_required := false;
    end if;
  end if;

  insert into public.profiles (
    id,
    full_name,
    date_of_birth,
    age_band,
    teen_safety_mode,
    guardian_required
  )
  values (
    new.id,
    clean_full_name,
    clean_date_of_birth,
    resolved_age_band,
    resolved_teen_safety_mode,
    resolved_guardian_required
  )
  on conflict (id) do update
  set
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    date_of_birth = coalesce(public.profiles.date_of_birth, excluded.date_of_birth),
    age_band = case
      when public.profiles.age_band = 'unknown' then excluded.age_band
      else public.profiles.age_band
    end,
    teen_safety_mode = public.profiles.teen_safety_mode or excluded.teen_safety_mode,
    guardian_required = public.profiles.guardian_required or excluded.guardian_required;

  return new;
end;
$$;

comment on column public.profiles.date_of_birth is
'Date of birth used for age-band and teen-safety eligibility. Access should remain limited.';

comment on column public.profiles.age_band is
'Age band for safety handling: unknown, under_13, teen, or adult.';

comment on column public.profiles.teen_safety_mode is
'True when account should receive teen-specific safety protections.';

comment on column public.profiles.guardian_required is
'Reserved for future guardian/parental consent workflows.';

comment on function public.handle_new_user_profile() is
'Creates the initial public profile row for new Loombus auth users, including Teen Safety Mode metadata when supplied.';
