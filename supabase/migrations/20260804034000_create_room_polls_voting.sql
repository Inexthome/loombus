create table if not exists public.room_polls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  poll_type text not null default 'single',
  eligibility text not null default 'members',
  anonymous_voting boolean not null default false,
  show_live_results boolean not null default true,
  allow_vote_changes boolean not null default false,
  max_choices integer not null default 1,
  opens_at timestamptz not null default now(),
  closes_at timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade an older room_polls table in place before constraints or indexes
-- reference columns introduced by this feature.
alter table public.room_polls add column if not exists room_id uuid references public.rooms(id) on delete cascade;
alter table public.room_polls add column if not exists created_by uuid references public.profiles(id) on delete cascade;
alter table public.room_polls add column if not exists title text;
alter table public.room_polls add column if not exists description text;
alter table public.room_polls add column if not exists poll_type text not null default 'single';
alter table public.room_polls add column if not exists eligibility text not null default 'members';
alter table public.room_polls add column if not exists anonymous_voting boolean not null default false;
alter table public.room_polls add column if not exists show_live_results boolean not null default true;
alter table public.room_polls add column if not exists allow_vote_changes boolean not null default false;
alter table public.room_polls add column if not exists max_choices integer not null default 1;
alter table public.room_polls add column if not exists opens_at timestamptz not null default now();
alter table public.room_polls add column if not exists closes_at timestamptz;
alter table public.room_polls add column if not exists status text not null default 'open';
alter table public.room_polls add column if not exists created_at timestamptz not null default now();
alter table public.room_polls add column if not exists updated_at timestamptz not null default now();

create table if not exists public.room_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.room_polls(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  label text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

alter table public.room_poll_options add column if not exists poll_id uuid references public.room_polls(id) on delete cascade;
alter table public.room_poll_options add column if not exists room_id uuid references public.rooms(id) on delete cascade;
alter table public.room_poll_options add column if not exists label text;
alter table public.room_poll_options add column if not exists position integer;
alter table public.room_poll_options add column if not exists created_at timestamptz not null default now();

create table if not exists public.room_poll_ballots (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.room_polls(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_poll_ballots add column if not exists poll_id uuid references public.room_polls(id) on delete cascade;
alter table public.room_poll_ballots add column if not exists room_id uuid references public.rooms(id) on delete cascade;
alter table public.room_poll_ballots add column if not exists voter_id uuid references public.profiles(id) on delete cascade;
alter table public.room_poll_ballots add column if not exists submitted_at timestamptz not null default now();
alter table public.room_poll_ballots add column if not exists updated_at timestamptz not null default now();

create table if not exists public.room_poll_ballot_choices (
  ballot_id uuid not null references public.room_poll_ballots(id) on delete cascade,
  option_id uuid not null references public.room_poll_options(id) on delete cascade,
  poll_id uuid not null references public.room_polls(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.room_poll_ballot_choices add column if not exists ballot_id uuid references public.room_poll_ballots(id) on delete cascade;
alter table public.room_poll_ballot_choices add column if not exists option_id uuid references public.room_poll_options(id) on delete cascade;
alter table public.room_poll_ballot_choices add column if not exists poll_id uuid references public.room_polls(id) on delete cascade;
alter table public.room_poll_ballot_choices add column if not exists room_id uuid references public.rooms(id) on delete cascade;
alter table public.room_poll_ballot_choices add column if not exists created_at timestamptz not null default now();

create unique index if not exists room_poll_options_poll_position_uidx
  on public.room_poll_options(poll_id, position);
create unique index if not exists room_poll_ballots_poll_voter_uidx
  on public.room_poll_ballots(poll_id, voter_id);
create unique index if not exists room_poll_ballot_choices_ballot_option_uidx
  on public.room_poll_ballot_choices(ballot_id, option_id);
create index if not exists room_polls_room_status_idx
  on public.room_polls(room_id, status, closes_at, created_at desc);
create index if not exists room_poll_options_poll_idx
  on public.room_poll_options(poll_id, position);
create index if not exists room_poll_ballots_poll_idx
  on public.room_poll_ballots(poll_id, submitted_at desc);
create index if not exists room_poll_choices_poll_option_idx
  on public.room_poll_ballot_choices(poll_id, option_id);

alter table public.room_polls enable row level security;
alter table public.room_poll_options enable row level security;
alter table public.room_poll_ballots enable row level security;
alter table public.room_poll_ballot_choices enable row level security;
revoke all on public.room_polls, public.room_poll_options, public.room_poll_ballots, public.room_poll_ballot_choices from anon, authenticated;
grant all on public.room_polls, public.room_poll_options, public.room_poll_ballots, public.room_poll_ballot_choices to service_role;

comment on table public.room_polls is 'Private Room-native polls and organization voting definitions.';
comment on table public.room_poll_ballots is 'One private ballot per eligible Room member and poll.';