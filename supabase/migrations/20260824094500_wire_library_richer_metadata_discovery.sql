-- Loombus Library richer metadata discovery runtime.
-- Keeps the existing bounded published-catalog RPC as the single discovery truth path.

create index if not exists library_publications_published_series_trgm_idx
  on public.library_publications
  using gin (lower(series_title) extensions.gin_trgm_ops)
  where status = 'published' and series_title is not null;

create index if not exists library_publications_published_edition_trgm_idx
  on public.library_publications
  using gin (lower(edition_label) extensions.gin_trgm_ops)
  where status = 'published' and edition_label is not null;

create index if not exists library_publications_published_audience_trgm_idx
  on public.library_publications
  using gin (lower(audience_label) extensions.gin_trgm_ops)
  where status = 'published' and audience_label is not null;

create index if not exists library_publications_published_subjects_gin_idx
  on public.library_publications using gin (subjects)
  where status = 'published';

-- PostgreSQL cannot CREATE OR REPLACE a function with a changed RETURNS TABLE shape.
drop function if exists public.search_library_published_catalog(text,text,text,integer,integer);

create function public.search_library_published_catalog(
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
  series_title text,
  series_position numeric,
  edition_label text,
  subjects text[],
  audience_label text,
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
  v_order text;
begin
  if v_type is not null and v_type not in ('book','essay','research','report','guide','article','other') then
    raise exception 'library_discovery_publication_type_invalid';
  end if;
  if v_sort not in ('newest','oldest','title_asc','title_desc') then
    raise exception 'library_discovery_sort_invalid';
  end if;

  v_order := case v_sort
    when 'newest' then 'p.publication_date desc nulls last, lower(p.title) asc, p.id asc'
    when 'oldest' then 'p.publication_date asc nulls last, lower(p.title) asc, p.id asc'
    when 'title_asc' then 'lower(p.title) asc, p.id asc'
    else 'lower(p.title) desc, p.id asc'
  end;

  return query execute format($query$
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
      p.series_title,
      p.series_position,
      p.edition_label,
      p.subjects,
      p.audience_label,
      count(*) over() as total_count
    from public.library_publications p
    where p.status = 'published'
      and ($1::text is null or p.publication_type = $1)
      and (
        $2::text is null
        or p.discovery_search_text like '%%' || $2 || '%%'
        or lower(coalesce(p.series_title, '')) like '%%' || $2 || '%%'
        or lower(coalesce(p.edition_label, '')) like '%%' || $2 || '%%'
        or lower(coalesce(p.audience_label, '')) like '%%' || $2 || '%%'
        or exists (
          select 1
          from unnest(p.subjects) as subject(value)
          where lower(subject.value) like '%%' || $2 || '%%'
        )
      )
    order by %s
    limit $3
    offset $4
  $query$, v_order)
  using v_type, v_query, v_limit, v_offset;
end;
$$;

revoke all on function public.search_library_published_catalog(text,text,text,integer,integer) from public;
grant execute on function public.search_library_published_catalog(text,text,text,integer,integer) to anon, authenticated;

comment on function public.search_library_published_catalog(text,text,text,integer,integer) is
  'Bounded published-only Library catalog search including version-safe richer bibliographic metadata. RLS remains authoritative through SECURITY INVOKER.';