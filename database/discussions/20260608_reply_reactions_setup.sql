create table if not exists public.reply_reactions (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null references public.replies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now(),
  constraint reply_reactions_type_check
    check (
      reaction_type in (
        'helpful',
        'insightful',
        'well_reasoned',
        'changed_my_view',
        'needs_evidence'
      )
    ),
  constraint reply_reactions_unique_user_reply_type
    unique (reply_id, user_id, reaction_type)
);

create index if not exists reply_reactions_reply_idx
on public.reply_reactions(reply_id, created_at desc);

create index if not exists reply_reactions_user_idx
on public.reply_reactions(user_id, created_at desc);

alter table public.reply_reactions enable row level security;

drop policy if exists "Authenticated users can read reply reactions"
on public.reply_reactions;

create policy "Authenticated users can read reply reactions"
on public.reply_reactions
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create their own reply reactions"
on public.reply_reactions;

create policy "Authenticated users can create their own reply reactions"
on public.reply_reactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Authenticated users can delete their own reply reactions"
on public.reply_reactions;

create policy "Authenticated users can delete their own reply reactions"
on public.reply_reactions
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can manage reply reactions"
on public.reply_reactions;

create policy "Admins can manage reply reactions"
on public.reply_reactions
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);

revoke all on table public.reply_reactions from anon;
grant select, insert, delete on table public.reply_reactions to authenticated;

comment on table public.reply_reactions is
'Depth-based reaction signals for Loombus replies.';

comment on column public.reply_reactions.reaction_type is
'Reaction type: helpful, insightful, well_reasoned, changed_my_view, or needs_evidence.';
