-- Add versioned Library publication keywords without creating a parallel category model.
-- Existing library_publications.subjects remains the canonical category/subject classification.

alter table public.library_publications
  add column if not exists keywords text[] not null default '{}'::text[];

alter table public.library_publication_versions
  add column if not exists keywords text[] not null default '{}'::text[];

alter table public.library_publications
  add constraint library_publications_keywords_count_check
    check (cardinality(keywords) <= 20);

alter table public.library_publication_versions
  add constraint library_publication_versions_keywords_count_check
    check (cardinality(keywords) <= 20);

create or replace function public.library_normalize_keywords(p_keywords text[])
returns text[]
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  v_keyword text;
  v_result text[] := '{}'::text[];
  v_seen text[] := '{}'::text[];
  v_key text;
begin
  if p_keywords is null then
    return '{}'::text[];
  end if;

  if cardinality(p_keywords) > 20 then
    raise exception 'library_metadata_keywords_too_many';
  end if;

  foreach v_keyword in array p_keywords loop
    v_keyword := btrim(coalesce(v_keyword, ''));
    if v_keyword = '' then
      continue;
    end if;
    if char_length(v_keyword) > 60 then
      raise exception 'library_metadata_keyword_too_long';
    end if;
    v_key := lower(v_keyword);
    if not (v_key = any(v_seen)) then
      v_seen := array_append(v_seen, v_key);
      v_result := array_append(v_result, v_keyword);
    end if;
  end loop;

  return v_result;
end;
$$;

revoke all on function public.library_normalize_keywords(text[]) from public;

-- Keep Version 1 draft metadata synchronized with canonical draft truth.
create or replace function public.library_sync_initial_publication_keywords()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.active_version_id is null then
    return null;
  end if;

  update public.library_publication_versions
     set keywords = coalesce(new.keywords, '{}'::text[])
   where id = new.active_version_id
     and publication_id = new.id
     and version_status = 'draft';

  return null;
end;
$$;

revoke all on function public.library_sync_initial_publication_keywords() from public;

drop trigger if exists library_publications_sync_initial_keywords on public.library_publications;
create trigger library_publications_sync_initial_keywords
after update of keywords on public.library_publications
for each row execute function public.library_sync_initial_publication_keywords();

-- Keywords are part of immutable version metadata once a version is published/superseded.
create or replace function public.library_guard_immutable_publication_version_keywords()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.version_status in ('published', 'superseded')
     and new.keywords is distinct from old.keywords then
    raise exception 'library_published_version_is_immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists library_publication_versions_guard_keywords on public.library_publication_versions;
create trigger library_publication_versions_guard_keywords
before update of keywords on public.library_publication_versions
for each row execute function public.library_guard_immutable_publication_version_keywords();

-- New revision snapshots inherit the active version's keywords automatically.
create or replace function public.library_seed_revision_keywords()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_active_version_id uuid;
begin
  if new.version_number <= 1 or cardinality(coalesce(new.keywords, '{}'::text[])) > 0 then
    return new;
  end if;

  select active_version_id into v_active_version_id
    from public.library_publications
   where id = new.publication_id;

  if v_active_version_id is not null then
    select coalesce(keywords, '{}'::text[]) into new.keywords
      from public.library_publication_versions
     where id = v_active_version_id
       and publication_id = new.publication_id;
  end if;

  new.keywords := coalesce(new.keywords, '{}'::text[]);
  return new;
end;
$$;

drop trigger if exists library_publication_versions_seed_revision_keywords on public.library_publication_versions;
create trigger library_publication_versions_seed_revision_keywords
before insert on public.library_publication_versions
for each row execute function public.library_seed_revision_keywords();

-- When the controlled revision publish transaction promotes a draft version, carry its
-- versioned keywords back to the canonical publication row in the same transaction.
create or replace function public.library_publish_revision_keywords()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.version_status = 'draft' and new.version_status = 'published' then
    update public.library_publications
       set keywords = coalesce(new.keywords, '{}'::text[]),
           updated_at = now()
     where id = new.publication_id;
  end if;
  return null;
end;
$$;

revoke all on function public.library_publish_revision_keywords() from public;

drop trigger if exists library_publication_versions_publish_keywords on public.library_publication_versions;
create trigger library_publication_versions_publish_keywords
after update of version_status on public.library_publication_versions
for each row execute function public.library_publish_revision_keywords();

create or replace function public.update_library_author_keywords(
  p_publication_id uuid,
  p_keywords text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_keywords text[];
begin
  if v_user_id is null then raise exception 'library_keywords_auth_required'; end if;
  v_keywords := public.library_normalize_keywords(p_keywords);

  select a.submission_status into v_status
    from public.library_author_publications a
    join public.library_publications p on p.id = a.publication_id
   where a.publication_id = p_publication_id
     and a.user_id = v_user_id
     and a.retired_at is null
     and p.status = 'draft'
   for update of a, p;

  if v_status is null then raise exception 'library_keywords_publication_not_owned'; end if;
  if v_status not in ('draft', 'changes_requested') then raise exception 'library_keywords_publication_not_editable'; end if;

  update public.library_publications
     set keywords = v_keywords,
         updated_at = now()
   where id = p_publication_id
     and status = 'draft';
end;
$$;

create or replace function public.update_library_author_revision_keywords(
  p_version_id uuid,
  p_keywords text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
  v_publication_id uuid;
  v_keywords text[];
begin
  if v_user_id is null then raise exception 'library_revision_keywords_auth_required'; end if;
  v_keywords := public.library_normalize_keywords(p_keywords);

  select r.submission_status, r.publication_id
    into v_status, v_publication_id
    from public.library_publication_revision_reviews r
    join public.library_publication_versions v
      on v.id = r.version_id and v.publication_id = r.publication_id
    join public.library_publications p on p.id = r.publication_id
   where r.version_id = p_version_id
     and r.user_id = v_user_id
     and r.published_at is null
     and v.version_status = 'draft'
     and p.status = 'published'
     and p.active_version_id <> r.version_id
   for update of r, v;

  if v_status is null then raise exception 'library_revision_keywords_not_owned_or_editable'; end if;
  if v_status not in ('draft', 'changes_requested') then raise exception 'library_revision_keywords_not_editable'; end if;

  update public.library_publication_versions
     set keywords = v_keywords
   where id = p_version_id
     and publication_id = v_publication_id
     and version_status = 'draft';

  update public.library_publication_revision_reviews
     set updated_at = now()
   where version_id = p_version_id;
end;
$$;

revoke all on function public.update_library_author_keywords(uuid,text[]) from public;
revoke all on function public.update_library_author_revision_keywords(uuid,text[]) from public;
grant execute on function public.update_library_author_keywords(uuid,text[]) to authenticated;
grant execute on function public.update_library_author_revision_keywords(uuid,text[]) to authenticated;
