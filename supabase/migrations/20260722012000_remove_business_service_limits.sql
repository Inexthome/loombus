-- Remove arbitrary caps from searchable business services and service areas.

begin;

alter table public.business_services
  drop constraint if exists business_services_sort_order_check;

alter table public.business_services
  add constraint business_services_sort_order_check
  check (sort_order >= 0);

create or replace function public.replace_local_business_services(
  target_business_id uuid,
  actor_user_id uuid,
  services_payload jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  business_owner_id uuid;
  actor_is_admin boolean := false;
  service_item jsonb;
  service_position integer := 0;
  service_status text;
  service_sort_order integer;
begin
  if jsonb_typeof(coalesce(services_payload, '[]'::jsonb)) <> 'array' then
    raise exception 'Services payload must be an array.';
  end if;

  select business.owner_id
  into business_owner_id
  from public.businesses business
  where business.id = target_business_id
  for update;

  if not found then
    raise exception 'Business not found.';
  end if;

  select coalesce(profile.is_admin, false)
  into actor_is_admin
  from public.profiles profile
  where profile.id = actor_user_id;

  if not actor_is_admin
    and business_owner_id is distinct from actor_user_id
  then
    raise exception 'Business control is required.';
  end if;

  delete from public.business_services
  where business_id = target_business_id;

  for service_item in
    select value
    from jsonb_array_elements(coalesce(services_payload, '[]'::jsonb))
  loop
    if char_length(trim(coalesce(service_item ->> 'name', ''))) < 2 then
      raise exception 'Each service requires a name.';
    end if;

    service_status := lower(
      coalesce(nullif(trim(service_item ->> 'status'), ''), 'active')
    );
    if service_status not in ('active', 'paused', 'archived') then
      service_status := 'active';
    end if;

    service_sort_order := case
      when coalesce(service_item ->> 'sort_order', '') ~ '^[0-9]+$'
        then greatest((service_item ->> 'sort_order')::integer, 0)
      else service_position
    end;

    insert into public.business_services (
      business_id,
      created_by,
      name,
      description,
      category,
      price_text,
      booking_url,
      service_area,
      status,
      sort_order
    )
    values (
      target_business_id,
      actor_user_id,
      left(trim(service_item ->> 'name'), 160),
      left(coalesce(service_item ->> 'description', ''), 3000),
      nullif(left(trim(coalesce(service_item ->> 'category', '')), 100), ''),
      nullif(left(trim(coalesce(service_item ->> 'price_text', '')), 120), ''),
      nullif(left(trim(coalesce(service_item ->> 'booking_url', '')), 2000), ''),
      nullif(left(trim(coalesce(service_item ->> 'service_area', '')), 300), ''),
      service_status,
      service_sort_order
    );

    service_position := service_position + 1;
  end loop;
end;
$$;

revoke all on function public.replace_local_business_services(uuid, uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.replace_local_business_services(uuid, uuid, jsonb)
  to service_role;

notify pgrst, 'reload schema';

commit;
