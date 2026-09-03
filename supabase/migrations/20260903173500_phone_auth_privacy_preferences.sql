create table if not exists public.phone_privacy_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_discoverable boolean not null default false,
  contact_matching_enabled boolean not null default false,
  security_sms_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.phone_privacy_preferences enable row level security;

drop policy if exists "Users can read own phone privacy preferences" on public.phone_privacy_preferences;
create policy "Users can read own phone privacy preferences"
  on public.phone_privacy_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own phone privacy preferences" on public.phone_privacy_preferences;
create policy "Users can insert own phone privacy preferences"
  on public.phone_privacy_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own phone privacy preferences" on public.phone_privacy_preferences;
create policy "Users can update own phone privacy preferences"
  on public.phone_privacy_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.phone_privacy_preferences is
  'Private member controls for phone-number discovery, contact matching consent, and security SMS consent. Raw phone numbers remain in Supabase Auth.';
comment on column public.phone_privacy_preferences.phone_discoverable is
  'Explicit opt-in allowing future secure phone-number matching. Defaults off.';
comment on column public.phone_privacy_preferences.contact_matching_enabled is
  'Explicit opt-in for contact matching. Contact upload/access must still be separately consented to by the client.';
comment on column public.phone_privacy_preferences.security_sms_enabled is
  'Explicit opt-in for non-authentication security SMS. Defaults off until a general SMS delivery provider is configured.';
