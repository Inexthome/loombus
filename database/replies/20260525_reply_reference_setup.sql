-- Reply reference setup for Loombus
-- Purpose:
-- - Support "Respond to a point" without creating nested reply trees.
-- - Keep replies in one linear discussion thread.
-- - Store a lightweight reference to the reply being addressed.

alter table public.replies
  add column if not exists referenced_reply_id uuid references public.replies(id) on delete set null;

alter table public.replies
  add column if not exists quoted_excerpt text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'replies_no_self_reference'
  ) then
    alter table public.replies
      add constraint replies_no_self_reference
      check (referenced_reply_id is null or referenced_reply_id <> id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'replies_quoted_excerpt_length'
  ) then
    alter table public.replies
      add constraint replies_quoted_excerpt_length
      check (quoted_excerpt is null or char_length(quoted_excerpt) <= 500);
  end if;
end $$;

create index if not exists replies_referenced_reply_id_idx
  on public.replies (referenced_reply_id)
  where referenced_reply_id is not null;

comment on column public.replies.referenced_reply_id is
  'Optional reply reference for Respond to a point. This is not a nested thread parent.';

comment on column public.replies.quoted_excerpt is
  'Short stored excerpt from the referenced reply for display context.';
