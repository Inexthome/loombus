-- Loombus Library admin review workflow.
--
-- Adds admin-only review visibility and narrowly scoped review/publish RPCs for
-- submitted member-authored Library publications. Approval and publishing remain
-- separate actions. No service role, Storage access, EPUB ingestion, commerce, or
-- direct authenticated table mutation is introduced.

alter table public.library_author_publications
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid references auth.users(id) on delete set null;

create or replace function public.library_current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin is true
  );
$$;

revoke all on function public.library_current_user_is_admin() from public;
grant execute on function public.library_current_user_is_admin() to authenticated;

drop policy if exists "admins read library author review rows" on public.library_author_publications;
create policy "admins read library author review rows"
  on public.library_author_publications
  for select
  to authenticated
  using (public.library_current_user_is_admin());

drop policy if exists "admins read library publication metadata" on public.library_publications;
create policy "admins read library publication metadata"
  on public.library_publications
  for select
  to authenticated
  using (public.library_current_user_is_admin());

create or replace function public.review_library_author_publication(
  p_publication_id uuid,
  p_action text,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_status text;
  v_note text := nullif(btrim(coalesce(p_review_note, '')), '');
begin
  if v_admin_id is null then
    raise exception 'library_review_auth_required';
  end if;

  if not public.library_current_user_is_admin() then
    raise exception 'library_review_admin_required';
  end if;

  if p_action not in ('request_changes', 'approve', 'reject') then
    raise exception 'library_review_action_invalid';
  end if;

  if p_action in ('request_changes', 'reject') and v_note is null then
    raise exception 'library_review_note_required';
  end if;

  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'library_review_note_too_long';
  end if;

  select submission_status
    into v_status
    from public.library_author_publications
   where publication_id = p_publication_id
   for update;

  if v_status is null then
    raise exception 'library_review_publication_not_found';
  end if;

  if v_status <> 'submitted' then
    raise exception 'library_review_publication_not_pending';
  end if;

  if not exists (
    select 1
    from public.library_publications
    where id = p_publication_id
      and status = 'draft'
  ) then
    raise exception 'library_review_canonical_publication_not_pending';
  end if;

  update public.library_author_publications
     set submission_status = case p_action
           when 'request_changes' then 'changes_requested'
           when 'approve' then 'approved'
           when 'reject' then 'rejected'
         end,
         reviewed_at = now(),
         reviewed_by = v_admin_id,
         review_note = v_note,
         updated_at = now()
   where publication_id = p_publication_id;
end;
$$;

create or replace function public.publish_library_author_publication(
  p_publication_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_status text;
begin
  if v_admin_id is null then
    raise exception 'library_publish_auth_required';
  end if;

  if not public.library_current_user_is_admin() then
    raise exception 'library_publish_admin_required';
  end if;

  select submission_status
    into v_status
    from public.library_author_publications
   where publication_id = p_publication_id
   for update;

  if v_status is null then
    raise exception 'library_publish_publication_not_found';
  end if;

  if v_status <> 'approved' then
    raise exception 'library_publish_publication_not_approved';
  end if;

  update public.library_publications
     set status = 'published',
         publication_date = coalesce(publication_date, current_date),
         updated_at = now()
   where id = p_publication_id
     and status = 'draft';

  if not found then
    raise exception 'library_publish_canonical_publication_not_publishable';
  end if;

  update public.library_author_publications
     set published_at = now(),
         published_by = v_admin_id,
         updated_at = now()
   where publication_id = p_publication_id;
end;
$$;

revoke all on function public.review_library_author_publication(uuid, text, text) from public;
revoke all on function public.publish_library_author_publication(uuid) from public;
grant execute on function public.review_library_author_publication(uuid, text, text) to authenticated;
grant execute on function public.publish_library_author_publication(uuid) to authenticated;

comment on function public.review_library_author_publication(uuid, text, text) is
  'Admin-only Library editorial review transition. Request changes, approve, or reject a submitted author publication without publishing it.';
comment on function public.publish_library_author_publication(uuid) is
  'Admin-only publication transition. Publishes only an already-approved author publication; approval and publication remain distinct actions.';
comment on column public.library_author_publications.reviewed_by is
  'Authenticated Loombus admin who recorded the latest editorial review decision.';
comment on column public.library_author_publications.published_at is
  'Time an approved author publication was deliberately moved into canonical published status.';
comment on column public.library_author_publications.published_by is
  'Authenticated Loombus admin who deliberately published the approved author publication.';
