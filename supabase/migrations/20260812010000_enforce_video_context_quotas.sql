-- Subscription runtime enforcement: Video Context quotas.
--
-- The attachment API records one row here only after a video attachment is
-- accepted. This ledger reserves both one monthly upload and the video's
-- duration against the member's monthly processing allowance. Reserving at
-- acceptance is intentionally conservative: a later processor may mark work
-- complete/failed, but concurrent uploads can never race past the advertised
-- subscription ceiling.
--
-- discussion_attachments historically enforced the original 3-minute / 250 MB
-- video ceiling. Relax those table-level checks only to the platform-wide
-- maximum; the API and quota ledger trigger below remain responsible for the
-- member-specific Free/Premium/Pro limits.

alter table public.discussion_attachments
  drop constraint if exists discussion_attachments_size_check,
  drop constraint if exists discussion_attachments_video_duration_check;

alter table public.discussion_attachments
  add constraint discussion_attachments_size_check
    check (
      file_size_bytes > 0
      and (
        (attachment_kind = 'video' and file_size_bytes <= 2147483648)
        or (attachment_kind <> 'video' and file_size_bytes <= 10485760)
      )
    ),
  add constraint discussion_attachments_video_duration_check
    check (
      (
        attachment_kind = 'video'
        and video_duration_seconds is not null
        and video_duration_seconds > 0
        and video_duration_seconds <= 3600
      )
      or (
        attachment_kind <> 'video'
        and video_duration_seconds is null
      )
    );

create table if not exists public.discussion_video_upload_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  discussion_id uuid not null,
  attachment_id uuid,
  tier text not null default 'free',
  video_duration_seconds integer not null,
  max_duration_seconds integer,
  file_size_bytes bigint,
  processing_status text not null default 'reserved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discussion_video_upload_events
  add column if not exists tier text,
  add column if not exists video_duration_seconds integer,
  add column if not exists max_duration_seconds integer,
  add column if not exists file_size_bytes bigint,
  add column if not exists processing_status text default 'reserved',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.discussion_video_upload_events
set processing_status = 'reserved'
where processing_status is null;

create index if not exists discussion_video_upload_events_user_created_idx
  on public.discussion_video_upload_events (user_id, created_at);

create unique index if not exists discussion_video_upload_events_attachment_uidx
  on public.discussion_video_upload_events (attachment_id)
  where attachment_id is not null;

alter table public.discussion_video_upload_events enable row level security;

create or replace function public.enforce_video_context_subscription_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_tier text;
  upload_limit integer;
  max_video_seconds integer;
  monthly_seconds_limit integer;
  month_start timestamptz;
  next_month_start timestamptz;
  used_uploads integer;
  used_seconds bigint;
begin
  if new.user_id is null then
    raise exception using
      errcode = '22023',
      message = 'Video Context usage requires a user id.';
  end if;

  if new.video_duration_seconds is null or new.video_duration_seconds <= 0 then
    raise exception using
      errcode = '22023',
      message = 'Video Context duration must be greater than zero.';
  end if;

  normalized_tier := lower(replace(coalesce(new.tier, 'free'), '-', '_'));

  case normalized_tier
    when 'admin' then
      upload_limit := 999999;
      max_video_seconds := 3600;
      monthly_seconds_limit := 59999940;
    when 'premium_plus' then
      upload_limit := 50;
      max_video_seconds := 1800;
      monthly_seconds_limit := 54000;
    when 'premium_pro' then
      upload_limit := 50;
      max_video_seconds := 1800;
      monthly_seconds_limit := 54000;
    when 'pro' then
      upload_limit := 50;
      max_video_seconds := 1800;
      monthly_seconds_limit := 54000;
    when 'premium' then
      upload_limit := 25;
      max_video_seconds := 900;
      monthly_seconds_limit := 9000;
    else
      normalized_tier := 'free';
      upload_limit := 3;
      max_video_seconds := 300;
      monthly_seconds_limit := 900;
  end case;

  new.tier := normalized_tier;
  new.max_duration_seconds := max_video_seconds;
  new.processing_status := coalesce(nullif(new.processing_status, ''), 'reserved');
  new.created_at := coalesce(new.created_at, now());
  new.updated_at := now();

  if new.video_duration_seconds > max_video_seconds then
    raise exception using
      errcode = 'P0001',
      message = format(
        'VIDEO_CONTEXT_MAX_DURATION:%s:%s',
        max_video_seconds,
        normalized_tier
      );
  end if;

  month_start := date_trunc('month', new.created_at at time zone 'UTC') at time zone 'UTC';
  next_month_start := month_start + interval '1 month';

  -- Serialize quota reservations for the same member and UTC billing month.
  -- This makes the count + duration checks race-safe across simultaneous API
  -- requests without globally locking the ledger table.
  perform pg_advisory_xact_lock(
    hashtextextended(
      new.user_id::text || ':' || to_char(month_start, 'YYYY-MM'),
      0
    )
  );

  select
    count(*)::integer,
    coalesce(sum(video_duration_seconds), 0)::bigint
  into used_uploads, used_seconds
  from public.discussion_video_upload_events
  where user_id = new.user_id
    and created_at >= month_start
    and created_at < next_month_start
    and coalesce(processing_status, 'reserved') <> 'voided';

  if used_uploads >= upload_limit then
    raise exception using
      errcode = 'P0001',
      message = format(
        'VIDEO_CONTEXT_MONTHLY_UPLOAD_LIMIT:%s:%s',
        upload_limit,
        normalized_tier
      );
  end if;

  if used_seconds + new.video_duration_seconds > monthly_seconds_limit then
    raise exception using
      errcode = 'P0001',
      message = format(
        'VIDEO_CONTEXT_MONTHLY_MINUTES_LIMIT:%s:%s',
        monthly_seconds_limit / 60,
        normalized_tier
      );
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_video_context_subscription_quota() from public;
revoke all on function public.enforce_video_context_subscription_quota() from anon;
revoke all on function public.enforce_video_context_subscription_quota() from authenticated;

drop trigger if exists enforce_video_context_subscription_quota_trigger
  on public.discussion_video_upload_events;

create trigger enforce_video_context_subscription_quota_trigger
before insert on public.discussion_video_upload_events
for each row
execute function public.enforce_video_context_subscription_quota();

comment on table public.discussion_video_upload_events is
  'Server-side Video Context quota ledger. Each non-voided row reserves one upload and its duration against the member monthly plan allowance.';

comment on column public.discussion_video_upload_events.processing_status is
  'reserved while quota is consumed; downstream processing may use processing/complete/failed. Only explicit voided rows stop consuming quota.';
