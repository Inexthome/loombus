-- Everything Search foundation: one secure, extensible index across Loombus content.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.loombus_search_documents (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  entity_type text not null,
  entity_id uuid not null,
  parent_id uuid,
  room_id uuid references public.rooms(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  summary text not null default '',
  body text not null default '',
  keywords text[] not null default '{}'::text[],
  href text not null,
  visibility text not null default 'public',
  status text not null default 'active',
  signal_score numeric(8, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  search_vector tsvector not null default ''::tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loombus_search_documents_source_length_check
    check (char_length(source_table) between 1 and 100),
  constraint loombus_search_documents_type_length_check
    check (char_length(entity_type) between 1 and 80),
  constraint loombus_search_documents_title_length_check
    check (char_length(title) between 1 and 300),
  constraint loombus_search_documents_href_length_check
    check (char_length(href) between 1 and 500),
  constraint loombus_search_documents_visibility_check
    check (visibility in ('public', 'authenticated', 'premium', 'member', 'private')),
  constraint loombus_search_documents_status_check
    check (status in ('active', 'archived'))
);

create unique index if not exists loombus_search_documents_source_entity_unique_idx
  on public.loombus_search_documents (source_table, entity_id);

create index if not exists loombus_search_documents_search_vector_idx
  on public.loombus_search_documents using gin (search_vector);

create index if not exists loombus_search_documents_type_created_idx
  on public.loombus_search_documents (entity_type, source_created_at desc);

create index if not exists loombus_search_documents_room_created_idx
  on public.loombus_search_documents (room_id, source_created_at desc)
  where room_id is not null;

create index if not exists loombus_search_documents_owner_created_idx
  on public.loombus_search_documents (owner_id, source_created_at desc)
  where owner_id is not null;

create or replace function public.set_loombus_search_vector()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(array_to_string(new.keywords, ' '), '')), 'A')
    || setweight(to_tsvector('simple', coalesce(new.summary, '')), 'B')
    || setweight(to_tsvector('simple', coalesce(new.body, '')), 'C')
    || setweight(to_tsvector('simple', coalesce(new.metadata::text, '')), 'D');
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_loombus_search_vector_trigger
  on public.loombus_search_documents;

create trigger set_loombus_search_vector_trigger
before insert or update on public.loombus_search_documents
for each row execute function public.set_loombus_search_vector();

alter table public.loombus_search_documents enable row level security;

revoke all on table public.loombus_search_documents
  from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
