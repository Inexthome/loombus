insert into public.rooms (
  id,
  name,
  description,
  type,
  visibility,
  is_private,
  member_count,
  activity_count,
  last_activity_at
)
values (
  '22222222-2222-4222-8222-222222222222'::uuid,
  'Traverze Culture',
  'A culture-focused room for thoughtful conversations about social behavior, media, values, identity, and how people make meaning.',
  'Culture',
  'public',
  false,
  0,
  0,
  now()
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  type = excluded.type,
  visibility = excluded.visibility,
  is_private = excluded.is_private,
  updated_at = now();
