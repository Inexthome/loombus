-- Phase 3 exact media fingerprinting and protected duplicate review.
begin;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.media_fingerprints (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('discussion_attachment','marketplace_photo','request_attachment','service_attachment')),
  source_record_id uuid,
  storage_bucket text not null,
  storage_path text not null,
  file_name text,
  mime_type text not null default 'application/octet-stream',
  media_kind text not null default 'file' check (media_kind in ('image','video','pdf','file')),
  byte_size bigint check (byte_size is null or byte_size > 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds > 0),
  exact_sha256 text check (exact_sha256 is null or exact_sha256 ~ '^[0-9a-f]{64}$'),
  scan_status text not null default 'pending' check (scan_status in ('pending','scanning','ready','error')),
  scan_error text,
  scan_started_at timestamptz,
  scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.media_duplicate_signals (
  id uuid primary key default gen_random_uuid(),
  left_media_id uuid not null references public.media_fingerprints(id) on delete cascade,
  right_media_id uuid not null references public.media_fingerprints(id) on delete cascade,
  signal_kind text not null default 'exact_content' check (signal_kind = 'exact_content'),
  confidence numeric(5,4) not null default 1 check (confidence between 0 and 1),
  cross_account boolean not null default true,
  status text not null default 'open' check (status in ('open','confirmed','dismissed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (left_media_id <> right_media_id),
  unique (left_media_id, right_media_id, signal_kind)
);

create index if not exists media_fingerprints_scan_idx on public.media_fingerprints(scan_status,created_at) where scan_status in ('pending','error');
create index if not exists media_fingerprints_hash_idx on public.media_fingerprints(exact_sha256) where exact_sha256 is not null and scan_status = 'ready';
create index if not exists media_fingerprints_owner_idx on public.media_fingerprints(owner_user_id,created_at desc);
create index if not exists media_fingerprints_source_idx on public.media_fingerprints(source_type,source_record_id) where source_record_id is not null;
create index if not exists media_duplicate_signals_status_idx on public.media_duplicate_signals(status,created_at desc);

create or replace function public.infer_media_mime_from_path(input_path text)
returns text language sql immutable parallel safe set search_path=public as $$
  select case
    when lower(coalesce(input_path,'')) ~ '\.(jpe?g)$' then 'image/jpeg'
    when lower(coalesce(input_path,'')) ~ '\.png$' then 'image/png'
    when lower(coalesce(input_path,'')) ~ '\.webp$' then 'image/webp'
    when lower(coalesce(input_path,'')) ~ '\.gif$' then 'image/gif'
    when lower(coalesce(input_path,'')) ~ '\.(mp4|m4v)$' then 'video/mp4'
    when lower(coalesce(input_path,'')) ~ '\.mov$' then 'video/quicktime'
    when lower(coalesce(input_path,'')) ~ '\.webm$' then 'video/webm'
    when lower(coalesce(input_path,'')) ~ '\.pdf$' then 'application/pdf'
    else 'application/octet-stream' end;
$$;

create or replace function public.media_kind_for_mime(input_mime text)
returns text language sql immutable parallel safe set search_path=public as $$
  select case
    when lower(coalesce(input_mime,'')) like 'image/%' then 'image'
    when lower(coalesce(input_mime,'')) like 'video/%' then 'video'
    when lower(coalesce(input_mime,'')) = 'application/pdf' then 'pdf'
    else 'file' end;
$$;

create or replace function public.register_media_reference(
  target_owner_user_id uuid,
  target_source_type text,
  target_source_record_id uuid,
  target_storage_bucket text,
  target_storage_path text,
  target_file_name text default null,
  target_mime_type text default null,
  target_byte_size bigint default null,
  target_duration_seconds numeric default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare registered_id uuid; normalized_mime text;
begin
  if target_owner_user_id is null then raise exception 'Media owner is required.'; end if;
  if target_source_type not in ('discussion_attachment','marketplace_photo','request_attachment','service_attachment') then raise exception 'Unsupported media source type.'; end if;
  if nullif(trim(coalesce(target_storage_bucket,'')),'') is null or nullif(trim(coalesce(target_storage_path,'')),'') is null then raise exception 'Media storage location is required.'; end if;
  if target_storage_path not like (target_owner_user_id::text || '/%') then raise exception 'Media storage ownership mismatch.'; end if;
  if (target_source_type='discussion_attachment' and target_storage_bucket<>'discussion-attachments')
    or (target_source_type='marketplace_photo' and target_storage_bucket<>'marketplace-images')
    or (target_source_type='request_attachment' and target_storage_bucket<>'service-request-attachments')
    or (target_source_type='service_attachment' and target_storage_bucket<>'provider-service-attachments')
  then raise exception 'Media source and storage bucket do not match.'; end if;
  normalized_mime := coalesce(nullif(lower(trim(coalesce(target_mime_type,''))),''),public.infer_media_mime_from_path(target_storage_path));
  insert into public.media_fingerprints(owner_user_id,source_type,source_record_id,storage_bucket,storage_path,file_name,mime_type,media_kind,byte_size,duration_seconds,updated_at)
  values(target_owner_user_id,target_source_type,target_source_record_id,target_storage_bucket,target_storage_path,nullif(trim(coalesce(target_file_name,'')),''),normalized_mime,public.media_kind_for_mime(normalized_mime),case when target_byte_size>0 then target_byte_size end,case when target_duration_seconds>0 then target_duration_seconds end,now())
  on conflict(storage_bucket,storage_path) do update set
    owner_user_id=excluded.owner_user_id,source_type=excluded.source_type,source_record_id=excluded.source_record_id,
    file_name=coalesce(excluded.file_name,public.media_fingerprints.file_name),mime_type=excluded.mime_type,media_kind=excluded.media_kind,
    byte_size=coalesce(excluded.byte_size,public.media_fingerprints.byte_size),duration_seconds=coalesce(excluded.duration_seconds,public.media_fingerprints.duration_seconds),updated_at=now()
  returning id into registered_id;
  return registered_id;
end; $$;

create or replace function public.remove_media_reference(target_owner_user_id uuid,target_storage_bucket text,target_storage_path text)
returns boolean language plpgsql security definer set search_path=public as $$
declare removed_count integer;
begin
  delete from public.media_fingerprints where owner_user_id=target_owner_user_id and storage_bucket=target_storage_bucket and storage_path=target_storage_path;
  get diagnostics removed_count=row_count;
  return removed_count>0;
end; $$;

create or replace function public.claim_media_fingerprint_scan(batch_limit integer default 5)
returns table(id uuid,owner_user_id uuid,source_type text,source_record_id uuid,storage_bucket text,storage_path text,file_name text,mime_type text,byte_size bigint,duration_seconds numeric)
language plpgsql security definer set search_path=public as $$
declare safe_limit integer:=least(greatest(coalesce(batch_limit,5),1),10);
begin
  update public.media_fingerprints set scan_status='pending',scan_started_at=null,scan_error='A previous scan did not finish.',updated_at=now()
  where scan_status='scanning' and scan_started_at<now()-interval '15 minutes';
  return query
  with candidates as (
    select f.id from public.media_fingerprints f where f.scan_status in ('pending','error') order by f.created_at for update skip locked limit safe_limit
  ), claimed as (
    update public.media_fingerprints f set scan_status='scanning',scan_started_at=now(),scan_error=null,updated_at=now()
    from candidates c where f.id=c.id returning f.*
  )
  select c.id,c.owner_user_id,c.source_type,c.source_record_id,c.storage_bucket,c.storage_path,c.file_name,c.mime_type,c.byte_size,c.duration_seconds from claimed c order by c.created_at;
end; $$;

create or replace function public.complete_media_fingerprint_scan(target_media_id uuid,target_exact_sha256 text,target_byte_size bigint,target_mime_type text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare current_media public.media_fingerprints%rowtype; normalized_hash text:=lower(trim(coalesce(target_exact_sha256,''))); normalized_mime text; inserted_signals integer:=0;
begin
  if normalized_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid media fingerprint.'; end if;
  if target_byte_size is null or target_byte_size<=0 then raise exception 'Invalid media byte size.'; end if;
  select * into current_media from public.media_fingerprints where id=target_media_id for update;
  if current_media.id is null then raise exception 'Media fingerprint record not found.'; end if;
  normalized_mime:=coalesce(nullif(lower(trim(coalesce(target_mime_type,''))),''),current_media.mime_type);
  update public.media_fingerprints set exact_sha256=normalized_hash,byte_size=target_byte_size,mime_type=normalized_mime,media_kind=public.media_kind_for_mime(normalized_mime),scan_status='ready',scan_error=null,scan_started_at=null,scanned_at=now(),updated_at=now()
  where id=target_media_id returning * into current_media;
  delete from public.media_duplicate_signals s using public.media_fingerprints l,public.media_fingerprints r
  where s.left_media_id=l.id and s.right_media_id=r.id and (s.left_media_id=target_media_id or s.right_media_id=target_media_id) and l.exact_sha256 is distinct from r.exact_sha256;
  insert into public.media_duplicate_signals(left_media_id,right_media_id,signal_kind,confidence,cross_account,status)
  select case when current_media.id::text<c.id::text then current_media.id else c.id end,
         case when current_media.id::text<c.id::text then c.id else current_media.id end,
         'exact_content',1,true,'open'
  from public.media_fingerprints c
  where c.id<>current_media.id and c.scan_status='ready' and c.exact_sha256=normalized_hash and c.owner_user_id<>current_media.owner_user_id
  on conflict(left_media_id,right_media_id,signal_kind) do nothing;
  get diagnostics inserted_signals=row_count;
  return jsonb_build_object('mediaId',current_media.id,'signalsCreated',inserted_signals,'scanStatus',current_media.scan_status);
end; $$;

create or replace function public.fail_media_fingerprint_scan(target_media_id uuid,target_error text)
returns boolean language plpgsql security definer set search_path=public as $$
declare updated_count integer;
begin
  update public.media_fingerprints set scan_status='error',scan_error=left(coalesce(nullif(trim(target_error),''),'Media could not be scanned.'),1000),scan_started_at=null,updated_at=now() where id=target_media_id;
  get diagnostics updated_count=row_count;
  return updated_count>0;
end; $$;

create or replace function public.sync_discussion_attachment_media()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then perform public.remove_media_reference(old.user_id,old.storage_bucket,old.storage_path); return old; end if;
  if tg_op='UPDATE' and (old.storage_bucket is distinct from new.storage_bucket or old.storage_path is distinct from new.storage_path) then perform public.remove_media_reference(old.user_id,old.storage_bucket,old.storage_path); end if;
  perform public.register_media_reference(new.user_id,'discussion_attachment',new.discussion_id,new.storage_bucket,new.storage_path,new.file_name,new.mime_type,new.file_size_bytes,new.video_duration_seconds);
  return new;
end; $$;

create or replace function public.sync_marketplace_listing_media()
returns trigger language plpgsql security definer set search_path=public as $$
declare item_path text;
begin
  if tg_op='DELETE' then delete from public.media_fingerprints where source_type='marketplace_photo' and source_record_id=old.id; return old; end if;
  delete from public.media_fingerprints where source_type='marketplace_photo' and source_record_id=new.id and not(storage_path=any(coalesce(new.photo_paths,'{}'::text[])));
  foreach item_path in array coalesce(new.photo_paths,'{}'::text[]) loop
    perform public.register_media_reference(new.seller_id,'marketplace_photo',new.id,'marketplace-images',item_path,regexp_replace(item_path,'^.*/',''),public.infer_media_mime_from_path(item_path),null,null);
  end loop;
  return new;
end; $$;

create or replace function public.sync_service_request_media()
returns trigger language plpgsql security definer set search_path=public as $$
declare i integer;
begin
  if tg_op='DELETE' then delete from public.media_fingerprints where source_type='request_attachment' and source_record_id=old.id; return old; end if;
  delete from public.media_fingerprints where source_type='request_attachment' and source_record_id=new.id and not(storage_path=any(coalesce(new.attachment_paths,'{}'::text[])));
  if cardinality(coalesce(new.attachment_paths,'{}'::text[]))>0 then
    for i in array_lower(new.attachment_paths,1)..array_upper(new.attachment_paths,1) loop
      perform public.register_media_reference(new.requester_id,'request_attachment',new.id,'service-request-attachments',new.attachment_paths[i],coalesce(new.attachment_names[i],regexp_replace(new.attachment_paths[i],'^.*/','')),coalesce(new.attachment_types[i],public.infer_media_mime_from_path(new.attachment_paths[i])),null,null);
    end loop;
  end if;
  return new;
end; $$;

create or replace function public.sync_provider_service_media()
returns trigger language plpgsql security definer set search_path=public as $$
declare i integer;
begin
  if tg_op='DELETE' then delete from public.media_fingerprints where source_type='service_attachment' and source_record_id=old.id; return old; end if;
  delete from public.media_fingerprints where source_type='service_attachment' and source_record_id=new.id and not(storage_path=any(coalesce(new.attachment_paths,'{}'::text[])));
  if cardinality(coalesce(new.attachment_paths,'{}'::text[]))>0 then
    for i in array_lower(new.attachment_paths,1)..array_upper(new.attachment_paths,1) loop
      perform public.register_media_reference(new.provider_id,'service_attachment',new.id,'provider-service-attachments',new.attachment_paths[i],coalesce(new.attachment_names[i],regexp_replace(new.attachment_paths[i],'^.*/','')),coalesce(new.attachment_types[i],public.infer_media_mime_from_path(new.attachment_paths[i])),null,null);
    end loop;
  end if;
  return new;
end; $$;

drop trigger if exists sync_discussion_attachment_media on public.discussion_attachments;
create trigger sync_discussion_attachment_media after insert or update or delete on public.discussion_attachments for each row execute function public.sync_discussion_attachment_media();
drop trigger if exists sync_marketplace_listing_media on public.marketplace_listings;
create trigger sync_marketplace_listing_media after insert or update of photo_paths or delete on public.marketplace_listings for each row execute function public.sync_marketplace_listing_media();
drop trigger if exists sync_service_request_media on public.service_requests;
create trigger sync_service_request_media after insert or update of attachment_paths,attachment_types,attachment_names or delete on public.service_requests for each row execute function public.sync_service_request_media();
drop trigger if exists sync_provider_service_media on public.provider_services;
create trigger sync_provider_service_media after insert or update of attachment_paths,attachment_types,attachment_names or delete on public.provider_services for each row execute function public.sync_provider_service_media();

do $$ begin
  perform public.register_media_reference(a.user_id,'discussion_attachment',a.discussion_id,a.storage_bucket,a.storage_path,a.file_name,a.mime_type,a.file_size_bytes,a.video_duration_seconds) from public.discussion_attachments a;
  perform public.register_media_reference(l.seller_id,'marketplace_photo',l.id,'marketplace-images',p.path,regexp_replace(p.path,'^.*/',''),public.infer_media_mime_from_path(p.path),null,null) from public.marketplace_listings l cross join lateral unnest(coalesce(l.photo_paths,'{}'::text[])) p(path);
  perform public.register_media_reference(r.requester_id,'request_attachment',r.id,'service-request-attachments',r.attachment_paths[idx.i],coalesce(r.attachment_names[idx.i],regexp_replace(r.attachment_paths[idx.i],'^.*/','')),coalesce(r.attachment_types[idx.i],public.infer_media_mime_from_path(r.attachment_paths[idx.i])),null,null) from public.service_requests r cross join lateral generate_subscripts(coalesce(r.attachment_paths,'{}'::text[]),1) as idx(i);
  perform public.register_media_reference(s.provider_id,'service_attachment',s.id,'provider-service-attachments',s.attachment_paths[idx.i],coalesce(s.attachment_names[idx.i],regexp_replace(s.attachment_paths[idx.i],'^.*/','')),coalesce(s.attachment_types[idx.i],public.infer_media_mime_from_path(s.attachment_paths[idx.i])),null,null) from public.provider_services s cross join lateral generate_subscripts(coalesce(s.attachment_paths,'{}'::text[]),1) as idx(i);
end; $$;

alter table public.media_fingerprints enable row level security;
alter table public.media_duplicate_signals enable row level security;
revoke all on table public.media_fingerprints,public.media_duplicate_signals from public,anon,authenticated;
revoke all on function public.infer_media_mime_from_path(text),public.media_kind_for_mime(text),public.register_media_reference(uuid,text,uuid,text,text,text,text,bigint,numeric),public.remove_media_reference(uuid,text,text),public.claim_media_fingerprint_scan(integer),public.complete_media_fingerprint_scan(uuid,text,bigint,text),public.fail_media_fingerprint_scan(uuid,text),public.sync_discussion_attachment_media(),public.sync_marketplace_listing_media(),public.sync_service_request_media(),public.sync_provider_service_media() from public,anon,authenticated;
grant all on table public.media_fingerprints,public.media_duplicate_signals to service_role;
grant execute on function public.infer_media_mime_from_path(text),public.media_kind_for_mime(text),public.register_media_reference(uuid,text,uuid,text,text,text,text,bigint,numeric),public.remove_media_reference(uuid,text,text),public.claim_media_fingerprint_scan(integer),public.complete_media_fingerprint_scan(uuid,text,bigint,text),public.fail_media_fingerprint_scan(uuid,text),public.sync_discussion_attachment_media(),public.sync_marketplace_listing_media(),public.sync_service_request_media(),public.sync_provider_service_media() to service_role;
comment on table public.media_fingerprints is 'Protected exact-byte fingerprint catalog for public-platform images, videos, and PDFs. Private Room media is excluded.';
comment on table public.media_duplicate_signals is 'Administrator-only cross-account exact-content signals. Signals do not remove, merge, suspend, or change source records.';
commit;
