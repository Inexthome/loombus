-- Loombus Library content-ingestion foundation.
-- Originals remain private in Supabase Storage; the Reader consumes normalized sections.

create table if not exists public.library_publication_sources (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  storage_provider text not null default 'supabase' check (storage_provider in ('supabase', 'r2')),
  storage_bucket text not null,
  storage_path text not null,
  media_type text not null check (media_type = 'application/epub+zip'),
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  ingestion_status text not null default 'pending' check (ingestion_status in ('pending', 'processing', 'ready', 'failed')),
  ingestion_error text,
  manifest_version integer not null default 1 check (manifest_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id),
  unique (storage_provider, storage_bucket, storage_path)
);

create table if not exists public.library_publication_sections (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.library_publications(id) on delete cascade,
  source_id uuid not null references public.library_publication_sources(id) on delete cascade,
  section_key text not null,
  ordinal integer not null check (ordinal >= 0),
  title text,
  content_html text not null,
  content_text text not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, section_key),
  unique (publication_id, ordinal)
);

create index if not exists library_publication_sections_publication_ordinal_idx
  on public.library_publication_sections(publication_id, ordinal);

alter table public.library_publication_sources enable row level security;
alter table public.library_publication_sections enable row level security;

-- Published normalized content is readable by authenticated members. Original source metadata
-- and all writes remain server/admin-only because no authenticated write policy is created here.
drop policy if exists library_publication_sections_authenticated_read on public.library_publication_sections;
create policy library_publication_sections_authenticated_read
  on public.library_publication_sections
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.library_publications p
      where p.id = library_publication_sections.publication_id
        and p.status = 'published'
    )
  );

revoke all on public.library_publication_sources from anon, authenticated;
revoke all on public.library_publication_sections from anon;
grant select on public.library_publication_sections to authenticated;

-- Private original EPUB bucket. This is intentionally non-public. The bucket row is idempotent.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-publication-originals',
  'library-publication-originals',
  false,
  52428800,
  array['application/epub+zip']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No browser storage.objects policy is created. Upload/download of originals must cross a
-- controlled server ingestion boundary rather than granting members arbitrary bucket access.
