-- Loombus Library published-price management.
-- Authors may change the USD price of an already-paid published publication
-- without unpublishing it. Free/paid access-mode transitions remain part of the
-- controlled publishing workflow so existing reader access is not silently revoked.

create or replace function public.update_library_author_published_price(
  p_publication_id uuid,
  p_price_cents integer,
  p_currency text default 'USD'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_owner_id uuid;
  v_status text;
  v_is_free boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select author_publication.user_id
    into v_owner_id
    from public.library_author_publications author_publication
   where author_publication.publication_id = p_publication_id
     and author_publication.retired_at is null;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Only the publication author can change its price.' using errcode = '42501';
  end if;

  select publication.status, publication.is_free
    into v_status, v_is_free
    from public.library_publications publication
   where publication.id = p_publication_id
   for update;

  if v_status is null then
    raise exception 'Publication not found.' using errcode = 'P0002';
  end if;

  if v_status <> 'published' then
    raise exception 'Published price management is available only while the publication is published.' using errcode = '22023';
  end if;

  if v_is_free is true then
    raise exception 'A free published publication cannot be converted to paid through price management.' using errcode = '22023';
  end if;

  if p_price_cents is null or p_price_cents < 100 or p_price_cents > 100000 then
    raise exception 'Price must be between $1.00 and $1,000.00.' using errcode = '22023';
  end if;

  if upper(coalesce(p_currency, '')) <> 'USD' then
    raise exception 'Library commerce currently supports USD only.' using errcode = '22023';
  end if;

  update public.library_publications
     set price_cents = p_price_cents,
         currency = 'USD',
         updated_at = now()
   where id = p_publication_id;
end;
$$;

revoke all on function public.update_library_author_published_price(uuid, integer, text) from public;
grant execute on function public.update_library_author_published_price(uuid, integer, text) to authenticated;

comment on function public.update_library_author_published_price(uuid, integer, text) is
  'Owner-only price update for an already-paid published Library publication. Historical purchases retain their snapshotted amount and platform fee.';
