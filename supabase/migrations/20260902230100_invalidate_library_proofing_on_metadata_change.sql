-- Final author proofing must also describe the metadata being submitted.
-- Any author-editable version metadata change clears the prior proof so the author
-- must review the final staged edition again before submission.

create or replace function public.invalidate_library_author_proofing_on_version_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.library_author_proofing_attestations
   where version_id = old.id;
  return new;
end;
$$;

revoke all on function public.invalidate_library_author_proofing_on_version_change() from public;

drop trigger if exists invalidate_library_author_proofing_on_version_change
  on public.library_publication_versions;
create trigger invalidate_library_author_proofing_on_version_change
before update of title, subtitle, description, publication_type, author_name, publisher_name,
                 language_code, cover_url, isbn, publication_date, is_free, subjects, keywords
on public.library_publication_versions
for each row
when (
  old.title is distinct from new.title
  or old.subtitle is distinct from new.subtitle
  or old.description is distinct from new.description
  or old.publication_type is distinct from new.publication_type
  or old.author_name is distinct from new.author_name
  or old.publisher_name is distinct from new.publisher_name
  or old.language_code is distinct from new.language_code
  or old.cover_url is distinct from new.cover_url
  or old.isbn is distinct from new.isbn
  or old.publication_date is distinct from new.publication_date
  or old.is_free is distinct from new.is_free
  or old.subjects is distinct from new.subjects
  or old.keywords is distinct from new.keywords
)
execute function public.invalidate_library_author_proofing_on_version_change();

comment on function public.invalidate_library_author_proofing_on_version_change() is
  'Clears an author proofing attestation when submit-relevant metadata for that exact Library version changes.';
