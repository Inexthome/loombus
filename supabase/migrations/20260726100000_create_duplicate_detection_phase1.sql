-- Phase 1 duplicate detection for Discussions, Replies, and Businesses.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.discussions
  add column if not exists submission_fingerprint text;

alter table public.replies
  add column if not exists submission_fingerprint text;

alter table public.businesses
  add column if not exists submission_fingerprint text;

create table if not exists public.duplicate_request_keys (
  fingerprint text primary key,
  request_kind text not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text,
  target_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  constraint duplicate_request_kind_check
    check (request_kind in ('discussion', 'reply', 'business')),
  constraint duplicate_request_fingerprint_length_check
    check (char_length(fingerprint) = 64)
);

create index if not exists duplicate_request_keys_actor_created_idx
  on public.duplicate_request_keys (actor_user_id, created_at desc);

create index if not exists duplicate_request_keys_expiration_idx
  on public.duplicate_request_keys (expires_at)
  where target_id is null;

create unique index if not exists discussions_submission_fingerprint_unique_idx
  on public.discussions (submission_fingerprint)
  where submission_fingerprint is not null;

create unique index if not exists replies_submission_fingerprint_unique_idx
  on public.replies (submission_fingerprint)
  where submission_fingerprint is not null;

create unique index if not exists businesses_submission_fingerprint_unique_idx
  on public.businesses (submission_fingerprint)
  where submission_fingerprint is not null;

create or replace function public.normalize_duplicate_text(input_value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select trim(
    regexp_replace(
      lower(coalesce(input_value, '')),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.normalize_duplicate_website(input_value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select lower(
    split_part(
      regexp_replace(
        regexp_replace(trim(coalesce(input_value, '')), '^https?://', '', 'i'),
        '^www\.',
        '',
        'i'
      ),
      '/',
      1
    )
  );
$$;

create or replace function public.duplicate_request_fingerprint(
  request_kind text,
  actor_user_id uuid,
  scope_key text default '',
  title_value text default '',
  body_value text default '',
  identity_value text default '',
  bucket_date date default current_date
)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select encode(
    extensions.digest(
      convert_to(
        concat_ws(
          '|',
          lower(coalesce(request_kind, '')),
          coalesce(actor_user_id::text, ''),
          public.normalize_duplicate_text(scope_key),
          public.normalize_duplicate_text(title_value),
          public.normalize_duplicate_text(body_value),
          public.normalize_duplicate_text(identity_value),
          coalesce(bucket_date::text, '')
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.claim_duplicate_request(
  request_kind text,
  actor_user_id uuid,
  scope_key text default '',
  title_value text default '',
  body_value text default '',
  identity_value text default '',
  bucket_date date default current_date,
  ttl_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  request_key text;
  existing public.duplicate_request_keys%rowtype;
  safe_ttl integer := least(greatest(coalesce(ttl_seconds, 120), 30), 600);
begin
  if request_kind not in ('discussion', 'reply', 'business') then
    raise exception 'Unsupported duplicate request kind.';
  end if;

  if actor_user_id is null then
    raise exception 'Duplicate request actor is required.';
  end if;

  request_key := public.duplicate_request_fingerprint(
    request_kind,
    actor_user_id,
    scope_key,
    title_value,
    body_value,
    identity_value,
    bucket_date
  );

  delete from public.duplicate_request_keys
  where expires_at < now() - interval '1 day';

  insert into public.duplicate_request_keys (
    fingerprint,
    request_kind,
    actor_user_id,
    created_at,
    expires_at
  ) values (
    request_key,
    request_kind,
    actor_user_id,
    now(),
    now() + make_interval(secs => safe_ttl)
  )
  on conflict (fingerprint) do nothing
  returning * into existing;

  if found then
    return jsonb_build_object(
      'claimed', true,
      'pending', false,
      'fingerprint', request_key,
      'targetId', null,
      'targetType', null
    );
  end if;

  select *
  into existing
  from public.duplicate_request_keys request_row
  where request_row.fingerprint = request_key
  for update;

  if existing.actor_user_id <> actor_user_id
    or existing.request_kind <> request_kind
  then
    raise exception 'Duplicate request ownership mismatch.';
  end if;

  if existing.target_id is not null then
    return jsonb_build_object(
      'claimed', false,
      'pending', false,
      'fingerprint', request_key,
      'targetId', existing.target_id,
      'targetType', existing.target_type
    );
  end if;

  if existing.expires_at <= now() then
    update public.duplicate_request_keys
    set
      created_at = now(),
      expires_at = now() + make_interval(secs => safe_ttl),
      target_type = null,
      target_id = null
    where fingerprint = request_key;

    return jsonb_build_object(
      'claimed', true,
      'pending', false,
      'fingerprint', request_key,
      'targetId', null,
      'targetType', null
    );
  end if;

  return jsonb_build_object(
    'claimed', false,
    'pending', true,
    'fingerprint', request_key,
    'targetId', null,
    'targetType', null
  );
end;
$$;

create or replace function public.set_discussion_submission_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.submission_fingerprint is null then
    new.submission_fingerprint := public.duplicate_request_fingerprint(
      'discussion',
      new.user_id,
      new.topic,
      new.title,
      new.body,
      new.discussion_type,
      (coalesce(new.created_at, now()) at time zone 'UTC')::date
    );
  end if;
  return new;
end;
$$;

create or replace function public.set_reply_submission_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.submission_fingerprint is null then
    new.submission_fingerprint := public.duplicate_request_fingerprint(
      'reply',
      new.user_id,
      new.discussion_id::text || ':' || coalesce(new.referenced_reply_id::text, ''),
      '',
      new.body,
      '',
      (coalesce(new.created_at, now()) at time zone 'UTC')::date
    );
  end if;
  return new;
end;
$$;

create or replace function public.set_business_submission_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.submission_fingerprint is null then
    new.submission_fingerprint := public.duplicate_request_fingerprint(
      'business',
      new.created_by,
      new.country_code,
      new.name,
      concat_ws(' | ', new.address_line_1, new.address_line_2),
      concat_ws(
        '|',
        new.phone,
        new.contact_email,
        public.normalize_duplicate_website(new.website_url),
        new.city,
        new.region,
        new.postal_code
      ),
      date '1970-01-01'
    );
  end if;
  return new;
end;
$$;

create or replace function public.resolve_duplicate_request_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.submission_fingerprint is not null then
    update public.duplicate_request_keys
    set
      target_type = tg_table_name,
      target_id = new.id,
      expires_at = greatest(expires_at, now() + interval '1 day')
    where fingerprint = new.submission_fingerprint;
  end if;
  return new;
end;
$$;

drop trigger if exists set_discussion_submission_fingerprint
  on public.discussions;
create trigger set_discussion_submission_fingerprint
before insert on public.discussions
for each row execute function public.set_discussion_submission_fingerprint();

drop trigger if exists resolve_discussion_duplicate_request
  on public.discussions;
create trigger resolve_discussion_duplicate_request
after insert on public.discussions
for each row execute function public.resolve_duplicate_request_target();

drop trigger if exists set_reply_submission_fingerprint
  on public.replies;
create trigger set_reply_submission_fingerprint
before insert on public.replies
for each row execute function public.set_reply_submission_fingerprint();

drop trigger if exists resolve_reply_duplicate_request
  on public.replies;
create trigger resolve_reply_duplicate_request
after insert on public.replies
for each row execute function public.resolve_duplicate_request_target();

drop trigger if exists set_business_submission_fingerprint
  on public.businesses;
create trigger set_business_submission_fingerprint
before insert on public.businesses
for each row execute function public.set_business_submission_fingerprint();

drop trigger if exists resolve_business_duplicate_request
  on public.businesses;
create trigger resolve_business_duplicate_request
after insert on public.businesses
for each row execute function public.resolve_duplicate_request_target();

alter table public.duplicate_request_keys enable row level security;

revoke all on table public.duplicate_request_keys
  from public, anon, authenticated;

revoke all on function public.normalize_duplicate_text(text)
  from public, anon, authenticated;
revoke all on function public.normalize_duplicate_website(text)
  from public, anon, authenticated;
revoke all on function public.duplicate_request_fingerprint(text, uuid, text, text, text, text, date)
  from public, anon, authenticated;
revoke all on function public.claim_duplicate_request(text, uuid, text, text, text, text, date, integer)
  from public, anon, authenticated;
revoke all on function public.set_discussion_submission_fingerprint()
  from public, anon, authenticated;
revoke all on function public.set_reply_submission_fingerprint()
  from public, anon, authenticated;
revoke all on function public.set_business_submission_fingerprint()
  from public, anon, authenticated;
revoke all on function public.resolve_duplicate_request_target()
  from public, anon, authenticated;

grant all on table public.duplicate_request_keys to service_role;
grant execute on function public.normalize_duplicate_text(text) to service_role;
grant execute on function public.normalize_duplicate_website(text) to service_role;
grant execute on function public.duplicate_request_fingerprint(text, uuid, text, text, text, text, date)
  to service_role;
grant execute on function public.claim_duplicate_request(text, uuid, text, text, text, text, date, integer)
  to service_role;
grant execute on function public.set_discussion_submission_fingerprint() to service_role;
grant execute on function public.set_reply_submission_fingerprint() to service_role;
grant execute on function public.set_business_submission_fingerprint() to service_role;
grant execute on function public.resolve_duplicate_request_target() to service_role;

comment on table public.duplicate_request_keys is
  'Short-lived request claims and resolved targets used to make creation retries idempotent.';
comment on column public.discussions.submission_fingerprint is
  'Server-generated daily fingerprint used to prevent repeated Discussion submissions.';
comment on column public.replies.submission_fingerprint is
  'Server-generated daily fingerprint used to prevent repeated Reply submissions.';
comment on column public.businesses.submission_fingerprint is
  'Server-generated stable fingerprint used to prevent repeated Business creation requests.';

commit;
