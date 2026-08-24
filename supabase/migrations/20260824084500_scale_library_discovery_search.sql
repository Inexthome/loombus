-- Loombus Library discovery/search scalability.
--
-- Moves published-catalog search/filter/sort/pagination into PostgreSQL so `/library`
-- does not download the entire catalog and filter it in the browser.
-- The RPCs are deliberately published-only regardless of caller privileges.

create extension if not exists pg_trgm with schema extensions;

alter table public.library_publications
  add column if not exists discovery_search_text text
  generated always as (
    lower(
      coalesce(title, '') || ' ' ||
      coalesce(subtitle, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(author_name, '') || ' ' ||
      coalesce(publisher_name, '') || ' ' ||
      coalesce(isbn, '') || ' ' ||
      coalesce(publication_type, '') || ' ' ||
      coalesce(language_code, '')
    )
  ) stored;

create index if not exists library_publications_published_newest_idx
  on public.library_publications(publication_date desc nulls last, title asc, id asc)
  where status = 'published';

create index if not exists library_publications_published_title_idx
  on public.library_publications(lower(title), id)
  where status = 'published';

create index if not exists library_publications_published_type_newest_idx
  on public.library_publications(publication_type, publication_date desc nulls last, title asc, id asc)
  where status = 'published';

create index if not exists library_publications_discovery_search_trgm_idx
  on public.library_publications
  using gin (discovery_search_text extensions.gin_trgm_ops)
  where status = 'published';

create index if not exists library_publications_published_author_trgm_idx
  on public.library_publications
  using gin (lower(author_name) extensions.gin_trgm_ops)
  where status = 'published' and author_name is not null;

create or replace function public.search_library_published_catalog(
  p_query text default null,
  p_publication_type text default null,
  p_sort text default 'newest',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  title text,
  subtitle text,
  description text,
  publication_type text,
  author_name text,
  publisher_name text,
  language_code text,
  cover_url text,
  isbn text,
  publication_date date,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  v_query text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_type text := nullif(btrim(coalesce(p_publication_type, '')), '');
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'newest');
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 48));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 10000));
begin
  if v_type is not null and v_type not in ('book','essay','research','report','guide','article','other') then
    raise exception 'library_discovery_publication_type_invalid';
  end if;
  if v_sort not in ('newest','oldest','title_asc','title_desc') then
    raise exception 'library_discovery_sort_invalid';
  end if;

  return query
  select
    p.id,
    p.slug,
    p.title,
    p.subtitle,
    p.description,
    p.publication_type,
    p.author_name,
    p.publisher_name,
    p.language_code,
    p.cover_url,
    p.isbn,
    p.publication_date,
    count(*) over() as total_count
  from public.library_publications p
  where p.status = 'published'
    and (v_type is null or p.publication_type = v_type)
    and (v_query is null or p.discovery_search_text like '%' || v_query || '%')
  order by
    case when v_sort = 'newest' then p.publication_date end desc nulls last,
    case when v_sort = 'oldest' then p.publication_date end asc nulls last,
    case when v_sort = 'title_asc' then lower(p.title) end asc,
    case when v_sort = 'title_desc' then lower(p.title) end desc,
    case when v_sort in ('newest','oldest') then lower(p.title) end asc,
    p.id asc
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.search_library_published_authors(
  p_query text default null,
  p_limit integer default 36,
  p_offset integer default 0
)
returns table (
  author_name text,
  work_count bigint,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  v_query text := nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 36), 72));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 10000));
begin
  return query
  with authors as (
    select btrim(p.author_name) as name, count(*)::bigint as works
    from public.library_publications p
    where p.status = 'published'
      and p.author_name is not null
      and btrim(p.author_name) <> ''
      and (v_query is null or lower(p.author_name) like '%' || v_query || '%')
    group by btrim(p.author_name)
  )
  select a.name, a.works, count(*) over() as total_count
  from authors a
  order by lower(a.name), a.name
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.search_library_published_catalog(text,text,text,integer,integer) from public;
revoke all on function public.search_library_published_authors(text,integer,integer) from public;
grant execute on function public.search_library_published_catalog(text,text,text,integer,integer) to anon, authenticated;
grant execute on function public.search_library_published_authors(text,integer,integer) to anon, authenticated;

comment on function public.search_library_published_catalog(text,text,text,integer,integer) is
  'Bounded published-only Loombus Library catalog search/filter/sort query. RLS remains in force through SECURITY INVOKER.';
comment on function public.search_library_published_authors(text,integer,integer) is
  'Bounded published-only Loombus Library author aggregation for the Authors discovery tab.';
comment on column public.library_publications.discovery_search_text is
  'Stored lowercase discovery text used only to accelerate published Library catalog search.';
