begin;

create or replace function public.set_business_appointment_service_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  business_record record;
begin
  if new.source_type is null or btrim(new.source_type) = '' then
    new.source_type := 'business';
  end if;

  if new.source_type = 'business' then
    select b.id, b.name, b.slug
      into business_record
      from public.businesses b
     where b.id = new.business_id;

    if business_record.id is null then
      raise exception 'Appointment business source not found';
    end if;

    new.source_id := business_record.id;
    new.source_label := coalesce(nullif(btrim(new.source_label), ''), business_record.name);
    new.source_href := coalesce(
      nullif(btrim(new.source_href), ''),
      '/businesses/' || business_record.slug
    );
  elsif new.source_id is null then
    raise exception 'Non-business appointment services require a source id';
  end if;

  return new;
end;
$$;

create or replace function public.copy_appointment_request_source()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_service record;
begin
  select
    s.business_id,
    s.owner_id,
    s.source_type,
    s.source_id,
    s.source_label,
    s.source_href
  into appointment_service
  from public.business_appointment_services s
  where s.id = new.service_id;

  if appointment_service.business_id is null then
    raise exception 'Appointment service not found';
  end if;

  if new.business_id is distinct from appointment_service.business_id
     or new.provider_id is distinct from appointment_service.owner_id then
    raise exception 'Appointment request attribution does not match its service';
  end if;

  new.source_type := appointment_service.source_type;
  new.source_id := appointment_service.source_id;
  new.source_label := appointment_service.source_label;
  new.source_href := appointment_service.source_href;

  return new;
end;
$$;

drop trigger if exists set_business_appointment_service_source_trigger
  on public.business_appointment_services;

create trigger set_business_appointment_service_source_trigger
before insert or update of business_id, source_type, source_id, source_label, source_href
on public.business_appointment_services
for each row
execute function public.set_business_appointment_service_source();

drop trigger if exists copy_appointment_request_source_trigger
  on public.business_appointment_requests;

create trigger copy_appointment_request_source_trigger
before insert
on public.business_appointment_requests
for each row
execute function public.copy_appointment_request_source();

revoke all on function public.set_business_appointment_service_source() from public;
revoke all on function public.copy_appointment_request_source() from public;

grant execute on function public.set_business_appointment_service_source() to service_role;
grant execute on function public.copy_appointment_request_source() to service_role;

comment on function public.set_business_appointment_service_source() is
  'Normalizes business-backed appointment service source metadata and requires source identity for future platform-backed services.';

comment on function public.copy_appointment_request_source() is
  'Copies immutable booking-source context from the selected appointment service into each new request.';

commit;
