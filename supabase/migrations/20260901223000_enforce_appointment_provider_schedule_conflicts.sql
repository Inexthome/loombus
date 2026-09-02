begin;

create or replace function public.enforce_business_appointment_provider_schedule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'accepted' then
    return new;
  end if;

  if new.provider_id is null
     or new.requested_start is null
     or new.requested_end is null
     or new.requested_end <= new.requested_start then
    raise exception using
      errcode = '23514',
      message = 'appointment_invalid_schedule';
  end if;

  -- Serialize accepted-booking changes for one provider inside the current
  -- transaction. This closes the race between an availability read and the
  -- write that accepts (or moves) a booking without blocking other providers.
  perform pg_advisory_xact_lock(
    hashtextextended(new.provider_id::text, 790)
  );

  if exists (
    select 1
      from public.business_appointment_requests existing
     where existing.provider_id = new.provider_id
       and existing.status = 'accepted'
       and existing.id is distinct from new.id
       and existing.requested_start < new.requested_end
       and existing.requested_end > new.requested_start
  ) then
    raise exception using
      errcode = '23P01',
      message = 'appointment_time_conflict';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_business_appointment_provider_schedule_trigger
  on public.business_appointment_requests;

create trigger enforce_business_appointment_provider_schedule_trigger
before insert or update of provider_id, status, requested_start, requested_end
on public.business_appointment_requests
for each row
execute function public.enforce_business_appointment_provider_schedule();

comment on function public.enforce_business_appointment_provider_schedule() is
  'Transactionally serializes accepted appointment schedule changes per provider and rejects overlapping accepted bookings.';

commit;
