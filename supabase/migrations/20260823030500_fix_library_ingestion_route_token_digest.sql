-- Align the Library ingestion route capability digest with the deployment-only token.
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
      = '42b14be3be6cdeee0767c86a29174c57d712d41dce18c0f01598ab8d3fb471cf';
$$;

revoke all on function public.library_ingestion_route_token_valid(text) from public;
