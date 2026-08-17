alter table public.library_highlights
  add column if not exists start_offset integer,
  add column if not exists end_offset integer,
  add column if not exists text_sha256 text;

alter table public.library_highlights
  drop constraint if exists library_highlights_text_range_check;

alter table public.library_highlights
  add constraint library_highlights_text_range_check
  check (
    (start_offset is null and end_offset is null and text_sha256 is null)
    or
    (
      start_offset is not null
      and end_offset is not null
      and start_offset >= 0
      and end_offset > start_offset
      and text_sha256 ~ '^[0-9a-f]{64}$'
    )
  );

comment on column public.library_highlights.start_offset is
  'Zero-based UTF-16 text offset into normalized section content_text at highlight creation time.';
comment on column public.library_highlights.end_offset is
  'Exclusive zero-based UTF-16 text offset into normalized section content_text at highlight creation time.';
comment on column public.library_highlights.text_sha256 is
  'SHA-256 of normalized section content_text used to invalidate stale ranges after content changes.';
