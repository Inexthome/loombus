begin;

alter table public.business_appointment_services
  add column if not exists source_type text not null default 'business',
  add column if not exists source_id uuid,
  add column if not exists source_label text,
  add column if not exists source_href text;

alter table public.business_appointment_requests
  add column if not exists source_type text not null default 'business',
  add column if not exists source_id uuid,
  add column if not exists source_label text,
  add column if not exists source_href text;

update public.business_appointment_services
set
  source_type = 'business',
  source_id = business_id,
  source_label = coalesce(
    source_label,
    (select b.name from public.businesses b where b.id = business_appointment_services.business_id)
  ),
  source_href = coalesce(
    source_href,
    (select '/businesses/' || b.slug from public.businesses b where b.id = business_appointment_services.business_id)
  )
where source_id is null
   or source_label is null
   or source_href is null;

update public.business_appointment_requests r
set
  source_type = coalesce(s.source_type, 'business'),
  source_id = coalesce(s.source_id, r.business_id),
  source_label = coalesce(
    s.source_label,
    (select b.name from public.businesses b where b.id = r.business_id)
  ),
  source_href = coalesce(
    s.source_href,
    (select '/businesses/' || b.slug from public.businesses b where b.id = r.business_id)
  )
from public.business_appointment_services s
where s.id = r.service_id
  and (
    r.source_id is null
    or r.source_label is null
    or r.source_href is null
  );

alter table public.business_appointment_services
  drop constraint if exists business_appointment_services_source_type_check;

alter table public.business_appointment_services
  add constraint business_appointment_services_source_type_check
  check (
    source_type in (
      'business',
      'provider_service',
      'marketplace_listing',
      'service_request',
      'room',
      'room_resource',
      'public_event',
      'local_listing'
    )
  );

alter table public.business_appointment_requests
  drop constraint if exists business_appointment_requests_source_type_check;

alter table public.business_appointment_requests
  add constraint business_appointment_requests_source_type_check
  check (
    source_type in (
      'business',
      'provider_service',
      'marketplace_listing',
      'service_request',
      'room',
      'room_resource',
      'public_event',
      'local_listing'
    )
  );

create index if not exists business_appointment_services_source_idx
  on public.business_appointment_services (source_type, source_id)
  where status <> 'archived';

create index if not exists business_appointment_requests_source_idx
  on public.business_appointment_requests (source_type, source_id, updated_at desc);

comment on column public.business_appointment_services.source_type is
  'Platform surface that owns the bookable service. Existing records remain business-backed.';
comment on column public.business_appointment_services.source_id is
  'Identifier of the originating business, service, listing, request, room, event, or local record.';
comment on column public.business_appointment_requests.source_type is
  'Immutable source context copied from the appointment service when a request is created.';
comment on column public.business_appointment_requests.source_id is
  'Immutable originating record identifier used by the appointments hub and contextual navigation.';

commit;
