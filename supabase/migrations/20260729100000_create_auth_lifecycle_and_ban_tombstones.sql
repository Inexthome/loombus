create extension if not exists pgcrypto with schema extensions;

create schema if not exists loombus_private;

revoke all on schema loombus_private from public;
revoke all on schema loombus_private from anon;
revoke all on schema loombus_private from authenticated;

create table if not exists loombus_private.account_ban_hmac_keys (
  key_id smallint primary key,
  secret bytea not null,
  created_at timestamptz not null default now(),
  constraint account_ban_hmac_keys_singleton check (key_id = 1)
);

insert into loombus_private.account_ban_hmac_keys (key_id, secret)
values (1, extensions.gen_random_bytes(32))
on conflict (key_id) do nothing;

create table if not exists loombus_private.account_ban_tombstones (
  id uuid primary key default gen_random_uuid(),
  source_user_id uuid,
  identifier_type text not null,
  identifier_hash bytea not null,
  reason_code text not null default 'permanent_policy_violation',
  reason_note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  constraint account_ban_tombstones_identifier_type_check
    check (identifier_type in ('email', 'provider_identity'))
);

create unique index if not exists account_ban_tombstones_active_identifier_idx
  on loombus_private.account_ban_tombstones (identifier_type, identifier_hash)
  where revoked_at is null;

create index if not exists account_ban_tombstones_source_user_idx
  on loombus_private.account_ban_tombstones (source_user_id, created_at desc);

revoke all on table loombus_private.account_ban_hmac_keys from public;
revoke all on table loombus_private.account_ban_hmac_keys from anon;
revoke all on table loombus_private.account_ban_hmac_keys from authenticated;
revoke all on table loombus_private.account_ban_tombstones from public;
revoke all on table loombus_private.account_ban_tombstones from anon;
revoke all on table loombus_private.account_ban_tombstones from authenticated;

create or replace function loombus_private.hash_account_ban_identifier(
  p_identifier_type text,
  p_identifier_value text
)
returns bytea
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions, loombus_private
as $$
declare
  v_secret bytea;
  v_type text;
  v_value text;
begin
  v_type := lower(btrim(coalesce(p_identifier_type, '')));
  v_value := btrim(coalesce(p_identifier_value, ''));

  if v_type not in ('email', 'provider_identity') or v_value = '' then
    return null;
  end if;

  if v_type = 'email' then
    v_value := lower(v_value);
  end if;

  select secret
  into v_secret
  from loombus_private.account_ban_hmac_keys
  where key_id = 1;

  if v_secret is null then
    raise exception 'Account-ban hashing key is unavailable.';
  end if;

  return extensions.hmac(
    convert_to(v_type || ':' || v_value, 'UTF8'),
    v_secret,
    'sha256'
  );
end;
$$;

revoke all on function loombus_private.hash_account_ban_identifier(text, text) from public;
revoke all on function loombus_private.hash_account_ban_identifier(text, text) from anon;
revoke all on function loombus_private.hash_account_ban_identifier(text, text) from authenticated;

create or replace function loombus_private.upsert_account_ban_tombstone(
  p_source_user_id uuid,
  p_identifier_type text,
  p_identifier_value text,
  p_reason_code text,
  p_reason_note text,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, loombus_private
as $$
declare
  v_hash bytea;
  v_id uuid;
begin
  v_hash := loombus_private.hash_account_ban_identifier(
    p_identifier_type,
    p_identifier_value
  );

  if v_hash is null then
    return null;
  end if;

  insert into loombus_private.account_ban_tombstones (
    source_user_id,
    identifier_type,
    identifier_hash,
    reason_code,
    reason_note,
    created_by,
    created_at,
    revoked_at,
    revoked_by
  )
  values (
    p_source_user_id,
    lower(btrim(p_identifier_type)),
    v_hash,
    coalesce(nullif(btrim(p_reason_code), ''), 'permanent_policy_violation'),
    nullif(btrim(coalesce(p_reason_note, '')), ''),
    p_created_by,
    now(),
    null,
    null
  )
  on conflict (identifier_type, identifier_hash) where revoked_at is null
  do update set
    source_user_id = excluded.source_user_id,
    reason_code = excluded.reason_code,
    reason_note = excluded.reason_note,
    created_by = excluded.created_by,
    created_at = now(),
    revoked_at = null,
    revoked_by = null
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function loombus_private.upsert_account_ban_tombstone(uuid, text, text, text, text, uuid) from public;
revoke all on function loombus_private.upsert_account_ban_tombstone(uuid, text, text, text, text, uuid) from anon;
revoke all on function loombus_private.upsert_account_ban_tombstone(uuid, text, text, text, text, uuid) from authenticated;

create or replace function loombus_private.sync_profile_ban_tombstones()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, loombus_private, auth
as $$
declare
  v_email text;
  v_identity record;
begin
  if new.account_status = 'banned'
     and old.account_status is distinct from 'banned' then
    select email
    into v_email
    from auth.users
    where id = new.id;

    perform loombus_private.upsert_account_ban_tombstone(
      new.id,
      'email',
      v_email,
      coalesce(new.enforcement_reason, 'permanent_policy_violation'),
      new.enforcement_note,
      new.enforced_by
    );

    for v_identity in
      select
        provider,
        coalesce(nullif(identity_data ->> 'sub', ''), id::text) as provider_subject
      from auth.identities
      where user_id = new.id
    loop
      perform loombus_private.upsert_account_ban_tombstone(
        new.id,
        'provider_identity',
        v_identity.provider || ':' || v_identity.provider_subject,
        coalesce(new.enforcement_reason, 'permanent_policy_violation'),
        new.enforcement_note,
        new.enforced_by
      );
    end loop;
  elsif old.account_status = 'banned'
        and new.account_status is distinct from 'banned' then
    update loombus_private.account_ban_tombstones
    set
      revoked_at = now(),
      revoked_by = new.enforced_by
    where source_user_id = new.id
      and revoked_at is null;
  end if;

  return new;
end;
$$;

revoke all on function loombus_private.sync_profile_ban_tombstones() from public;
revoke all on function loombus_private.sync_profile_ban_tombstones() from anon;
revoke all on function loombus_private.sync_profile_ban_tombstones() from authenticated;

drop trigger if exists sync_profile_ban_tombstones on public.profiles;
create trigger sync_profile_ban_tombstones
after update of account_status on public.profiles
for each row
when (old.account_status is distinct from new.account_status)
execute function loombus_private.sync_profile_ban_tombstones();

create or replace function loombus_private.reject_banned_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, loombus_private
as $$
declare
  v_hash bytea;
begin
  v_hash := loombus_private.hash_account_ban_identifier('email', new.email);

  if v_hash is not null and exists (
    select 1
    from loombus_private.account_ban_tombstones
    where identifier_type = 'email'
      and identifier_hash = v_hash
      and revoked_at is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Signup could not be completed.';
  end if;

  return new;
end;
$$;

revoke all on function loombus_private.reject_banned_auth_user() from public;
revoke all on function loombus_private.reject_banned_auth_user() from anon;
revoke all on function loombus_private.reject_banned_auth_user() from authenticated;

drop trigger if exists reject_banned_auth_user on auth.users;
create trigger reject_banned_auth_user
before insert on auth.users
for each row
execute function loombus_private.reject_banned_auth_user();

create or replace function loombus_private.reject_banned_auth_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, loombus_private
as $$
declare
  v_subject text;
  v_hash bytea;
begin
  v_subject := coalesce(nullif(new.identity_data ->> 'sub', ''), new.id::text);
  v_hash := loombus_private.hash_account_ban_identifier(
    'provider_identity',
    new.provider || ':' || v_subject
  );

  if v_hash is not null and exists (
    select 1
    from loombus_private.account_ban_tombstones
    where identifier_type = 'provider_identity'
      and identifier_hash = v_hash
      and revoked_at is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Signup could not be completed.';
  end if;

  return new;
end;
$$;

revoke all on function loombus_private.reject_banned_auth_identity() from public;
revoke all on function loombus_private.reject_banned_auth_identity() from anon;
revoke all on function loombus_private.reject_banned_auth_identity() from authenticated;

drop trigger if exists reject_banned_auth_identity on auth.identities;
create trigger reject_banned_auth_identity
before insert on auth.identities
for each row
execute function loombus_private.reject_banned_auth_identity();

do $$
declare
  v_profile record;
  v_identity record;
begin
  for v_profile in
    select
      p.id,
      p.enforcement_reason,
      p.enforcement_note,
      p.enforced_by,
      u.email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.account_status = 'banned'
  loop
    perform loombus_private.upsert_account_ban_tombstone(
      v_profile.id,
      'email',
      v_profile.email,
      coalesce(v_profile.enforcement_reason, 'permanent_policy_violation'),
      v_profile.enforcement_note,
      v_profile.enforced_by
    );

    for v_identity in
      select
        provider,
        coalesce(nullif(identity_data ->> 'sub', ''), id::text) as provider_subject
      from auth.identities
      where user_id = v_profile.id
    loop
      perform loombus_private.upsert_account_ban_tombstone(
        v_profile.id,
        'provider_identity',
        v_identity.provider || ':' || v_identity.provider_subject,
        coalesce(v_profile.enforcement_reason, 'permanent_policy_violation'),
        v_profile.enforcement_note,
        v_profile.enforced_by
      );
    end loop;
  end loop;
end;
$$;
