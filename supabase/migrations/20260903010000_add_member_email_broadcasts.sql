-- Durable member-email broadcast state and promotional-email preferences.
-- Application delivery remains server-side only; no client role receives table access.

create table if not exists public.marketing_email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null unique,
  subject text not null,
  status text not null default 'prepared' check (status in ('prepared', 'sending', 'sent', 'failed')),
  sender_email text not null,
  created_by uuid not null references auth.users(id),
  eligible_count integer not null default 0 check (eligible_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.member_email_campaign_recipients (
  campaign_id uuid not null references public.member_email_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'suppressed')),
  provider text,
  provider_message_id text,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index if not exists member_email_campaign_recipients_status_idx
  on public.member_email_campaign_recipients (campaign_id, status, created_at);

alter table public.marketing_email_preferences enable row level security;
alter table public.member_email_campaigns enable row level security;
alter table public.member_email_campaign_recipients enable row level security;

-- These tables are intentionally service-role only. Admin browser access goes through
-- the role-checked server route rather than direct Supabase queries.
revoke all on public.marketing_email_preferences from anon, authenticated;
revoke all on public.member_email_campaigns from anon, authenticated;
revoke all on public.member_email_campaign_recipients from anon, authenticated;
