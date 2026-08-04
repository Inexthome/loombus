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
  updated_at timestamptz not null default now(),
  constraint room_polls_title_length check (char_length(title) between 3 and 240),
  constraint room_polls_description_length check (description is null or char_length(description) <= 8000),
  constraint room_polls_type_check check (poll_type in ('single','multiple','yes_no','approval')),
  constraint room_polls_eligibility_check check (eligibility in ('members','board','managers')),
  constraint room_polls_status_check check (status in ('draft','open','closed','cancelled')),
  constraint room_polls_max_choices_check check (max_choices between 1 and 20),
  constraint room_polls_window_check check (closes_at is null or closes_at > opens_at)
);

create table if not exists public.room_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.room_polls(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  label text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  constraint room_poll_options_label_length check (char_length(label) between 1 and 500),
  constraint room_poll_options_position_positive check (position > 0),
  unique (poll_id, position)
);

create table if not exists public.room_poll_ballots (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.room_polls(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poll_id, voter_id)
);

create table if not exists public.room_poll_ballot_choices (
  ballot_id uuid not null references public.room_poll_ballots(id) on delete cascade,
  option_id uuid not null references public.room_poll_options(id) on delete cascade,
  poll_id uuid not null references public.room_polls(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ballot_id, option_id)
);

create index if not exists room_polls_room_status_idx on public.room_polls(room_id, status, closes_at, created_at desc);
create index if not exists room_poll_options_poll_idx on public.room_poll_options(poll_id, position);
create index if not exists room_poll_ballots_poll_idx on public.room_poll_ballots(poll_id, submitted_at desc);
create index if not exists room_poll_choices_poll_option_idx on public.room_poll_ballot_choices(poll_id, option_id);

alter table public.room_polls enable row level security;
alter table public.room_poll_options enable row level security;
alter table public.room_poll_ballots enable row level security;
alter table public.room_poll_ballot_choices enable row level security;
revoke all on public.room_polls, public.room_poll_options, public.room_poll_ballots, public.room_poll_ballot_choices from anon, authenticated;
grant all on public.room_polls, public.room_poll_options, public.room_poll_ballots, public.room_poll_ballot_choices to service_role;

comment on table public.room_polls is 'Private Room-native polls and organization voting definitions.';
comment on table public.room_poll_ballots is 'One private ballot per eligible Room member and poll.';