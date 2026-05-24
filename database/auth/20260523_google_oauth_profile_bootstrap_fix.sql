-- Loombus Google OAuth profile bootstrap fix
-- Applied in Supabase on 2026-05-23 / 2026-05-24.
--
-- Root cause:
-- public.profiles.username is NOT NULL with no default, while the previous
-- auth.users trigger inserted only id and full_name. New Google OAuth users
-- failed with "Database error saving new user" because profile creation
-- violated the username NOT NULL constraint.
--
-- This function derives a display name from Google/Supabase metadata and
-- creates a safe default username from the auth user UUID. Users can update
-- their username later from the profile page.

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  clean_full_name text;
  generated_username text;
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

  generated_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 20);

  insert into public.profiles (
    id,
    username,
    full_name
  )
  values (
    new.id,
    generated_username,
    clean_full_name
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;
