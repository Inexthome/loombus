-- Admin-visible member-email preference provenance and provider suppression state.
-- Marketing opt-outs stay separate from essential transactional email delivery.

alter table public.marketing_email_preferences
  add column if not exists unsubscribe_source text,
  add column if not exists unsubscribed_campaign_id uuid references public.member_email_campaigns(id) on delete set null;

alter table public.marketing_email_preferences
  drop constraint if exists marketing_email_preferences_unsubscribe_source_check;

alter table public.marketing_email_preferences
  add constraint marketing_email_preferences_unsubscribe_source_check
  check (unsubscribe_source is null or unsubscribe_source in ('email_link', 'provider', 'admin', 'other'));

update public.marketing_email_preferences
set unsubscribe_source = coalesce(unsubscribe_source, 'email_link')
where enabled = false;

create table if not exists public.email_delivery_suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  kind text not null check (kind in ('bounce', 'complaint', 'provider_suppression')),
  source text not null default 'resend_webhook' check (source in ('resend_webhook', 'admin', 'other')),
  provider text not null default 'resend',
  provider_event_id text unique,
  provider_message_id text,
  campaign_id uuid references public.member_email_campaigns(id) on delete set null,
  detail text,
  occurred_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_delivery_suppressions_email_active_idx
  on public.email_delivery_suppressions (lower(email), active, occurred_at desc);

create index if not exists email_delivery_suppressions_user_active_idx
  on public.email_delivery_suppressions (user_id, active, occurred_at desc)
  where user_id is not null;

alter table public.email_delivery_suppressions enable row level security;
revoke all on public.email_delivery_suppressions from anon, authenticated;
