-- Finalize the Library ingestion route capability digest for production deployment.
-- The plaintext capability remains server-only and is never stored in the database or repository.

create or replace function public.library_ingestion_route_token_valid(p_token text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select p_token is not null
    and encode(digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
      = '0a5a8ac52c95563fe21a3e1682ffba9378d1b2154c5216f29cee28fe109457e6';
$$;

revoke all on function public.library_ingestion_route_token_valid(text) from public;
