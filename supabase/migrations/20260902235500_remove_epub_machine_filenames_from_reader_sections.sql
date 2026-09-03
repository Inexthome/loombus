-- Remove machine-only XHTML filenames that were accidentally normalized into
-- Library Reader text (for example: ch001.xhtml, ch002.xhtml).
--
-- The historical section locator remains unchanged. Existing highlights that are
-- still bound to the exact pre-cleanup section text are shifted by the removed
-- prefix and rebound to the cleaned text hash so reader annotations remain valid.

create extension if not exists pgcrypto with schema extensions;

create temporary table library_epub_machine_filename_cleanup on commit drop as
select
  s.id as section_id,
  s.publication_id,
  s.section_key,
  s.content_text as old_content_text,
  regexp_replace(
    s.content_text,
    '^[[:space:]]*[^[:space:]<>]+\.x?html?[[:space:]]+',
    '',
    'i'
  ) as cleaned_content_text,
  regexp_replace(
    s.content_html,
    '^([[:space:]]*<p[^>]*>)[[:space:]]*[^[:space:]<>]+\.x?html?[[:space:]]+',
    E'\\1',
    'i'
  ) as cleaned_content_html,
  char_length(s.content_text) - char_length(
    regexp_replace(
      s.content_text,
      '^[[:space:]]*[^[:space:]<>]+\.x?html?[[:space:]]+',
      '',
      'i'
    )
  ) as removed_chars,
  encode(
    extensions.digest(convert_to(s.content_text, 'UTF8'), 'sha256'),
    'hex'
  ) as old_text_sha256,
  encode(
    extensions.digest(
      convert_to(
        regexp_replace(
          s.content_text,
          '^[[:space:]]*[^[:space:]<>]+\.x?html?[[:space:]]+',
          '',
          'i'
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  ) as cleaned_text_sha256
from public.library_publication_sections s
where s.content_text ~* '^[[:space:]]*[^[:space:]<>]+\.x?html?[[:space:]]+';

-- Preserve highlight anchors when they were created against the exact affected
-- section text. Highlights that were already stale are deliberately left alone.
update public.library_highlights h
   set start_offset = h.start_offset - c.removed_chars,
       end_offset = h.end_offset - c.removed_chars,
       text_sha256 = c.cleaned_text_sha256
  from library_epub_machine_filename_cleanup c
 where h.publication_id = c.publication_id
   and h.locator = c.section_key
   and h.text_sha256 = c.old_text_sha256
   and h.start_offset is not null
   and h.end_offset is not null
   and h.start_offset >= c.removed_chars
   and h.end_offset >= c.removed_chars;

update public.library_publication_sections s
   set content_text = c.cleaned_content_text,
       content_html = c.cleaned_content_html,
       content_sha256 = encode(
         extensions.digest(
           convert_to(c.cleaned_content_html || E'\n' || c.cleaned_content_text, 'UTF8'),
           'sha256'
         ),
         'hex'
       )
  from library_epub_machine_filename_cleanup c
 where s.id = c.section_id
   and char_length(btrim(c.cleaned_content_text)) > 0
   and char_length(btrim(c.cleaned_content_html)) > 0;

comment on table public.library_publication_sections is
  'Normalized, version-aware Library reading sections. Machine EPUB resource filenames are excluded from reader content.';
