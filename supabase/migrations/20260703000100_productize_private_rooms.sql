-- Productize private Loombus Rooms and remove legacy manually-created room records.
-- This migration is intentionally defensive because the V2 Rooms implementation has
-- supported multiple possible table names while the room schema stabilized.

create table if not exists public.room_product_templates (
  key text primary key,
  name text not null,
  room_type text not null,
  description text not null,
  default_tabs jsonb not null default '[]'::jsonb,
  default_permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_subscription_plans (
  key text primary key,
  name text not null,
  price_label text not null,
  member_limit_label text not null,
  checkout_mode text not null default 'self_serve',
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.room_product_templates (key, name, room_type, description, default_tabs, default_permissions)
values
  (
    'business-team',
    'Business Team Room',
    'business',
    'Private team planning, announcements, decisions, resources, tasks, and events.',
    '["discussion", "announcements", "resources", "tasks", "events", "members", "about", "settings"]'::jsonb,
    '{"visibility":"private","posting":"members","joining":"invite_only"}'::jsonb
  ),
  (
    'residents',
    'Resident / Condo Room',
    'residents',
    'Private resident announcements, maintenance updates, questions, documents, and events.',
    '["discussion", "announcements", "maintenance", "documents", "events", "members", "report_issue", "about", "settings"]'::jsonb,
    '{"visibility":"private","posting":"members","joining":"invite_only"}'::jsonb
  ),
  (
    'customer-support',
    'Customer Support Room',
    'customer_support',
    'Private support questions, known issues, help articles, feature requests, and product updates.',
    '["discussion", "questions", "known_issues", "help_articles", "feature_requests", "announcements", "members", "about", "settings"]'::jsonb,
    '{"visibility":"private","posting":"members","joining":"invite_only"}'::jsonb
  ),
  (
    'classroom',
    'Classroom Room',
    'classroom',
    'Private class prompts, resources, assignments, moderated discussion, and events.',
    '["discussion", "assignments", "resources", "events", "members", "about", "settings"]'::jsonb,
    '{"visibility":"private","posting":"members","joining":"invite_only"}'::jsonb
  )
on conflict (key) do update set
  name = excluded.name,
  room_type = excluded.room_type,
  description = excluded.description,
  default_tabs = excluded.default_tabs,
  default_permissions = excluded.default_permissions,
  updated_at = now();

insert into public.room_subscription_plans (key, name, price_label, member_limit_label, checkout_mode, features)
values
  ('free', 'Free Room', '$0', 'Up to 10 members', 'self_serve', '["1 private room", "Basic posts", "Basic resources", "Loombus branding"]'::jsonb),
  ('starter', 'Room Starter', '$19/mo', 'Up to 50 members', 'stripe_checkout', '["Private room", "Invite links", "Announcements", "Events"]'::jsonb),
  ('pro', 'Room Pro', '$49/mo', 'Up to 250 members', 'stripe_checkout', '["Advanced permissions", "Pinned resources", "Room analytics", "AI summaries"]'::jsonb),
  ('business', 'Organization', 'Custom', 'Multiple rooms', 'sales', '["Admin dashboard", "Custom onboarding", "Multiple moderators", "Higher limits"]'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  price_label = excluded.price_label,
  member_limit_label = excluded.member_limit_label,
  checkout_mode = excluded.checkout_mode,
  features = excluded.features,
  updated_at = now();

do $$
declare
  room_table text;
  room_table_reg regclass;
  column_name text;
  match_sql text;
begin
  foreach room_table in array array['rooms', 'loombus_rooms', 'community_rooms'] loop
    room_table_reg := to_regclass('public.' || room_table);

    if room_table_reg is not null then
      execute format('alter table public.%I add column if not exists template_key text', room_table);
      execute format('alter table public.%I add column if not exists subscription_plan text', room_table);
      execute format('alter table public.%I add column if not exists subscription_status text', room_table);
      execute format('alter table public.%I add column if not exists member_limit_label text', room_table);
      execute format('alter table public.%I add column if not exists default_tabs jsonb not null default ''[]''::jsonb', room_table);
      execute format('alter table public.%I add column if not exists default_permissions jsonb not null default ''{}''::jsonb', room_table);

      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = room_table and column_name = 'owner_id'
      ) is false then
        execute format('alter table public.%I add column owner_id uuid', room_table);
      end if;

      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = room_table and column_name = 'created_by'
      ) is false then
        execute format('alter table public.%I add column created_by uuid', room_table);
      end if;
    end if;
  end loop;

  create temporary table if not exists _loombus_legacy_room_cleanup_ids (
    source_table text not null,
    room_id text not null
  ) on commit drop;

  truncate table _loombus_legacy_room_cleanup_ids;

  foreach room_table in array array['rooms', 'loombus_rooms', 'community_rooms'] loop
    room_table_reg := to_regclass('public.' || room_table);

    if room_table_reg is null then
      continue;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = room_table and column_name = 'id'
    ) then
      continue;
    end if;

    match_sql := '';

    foreach column_name in array array['name', 'title', 'display_name'] loop
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = room_table and column_name = column_name
      ) then
        match_sql := match_sql || case when match_sql = '' then '' else ' or ' end || format('lower(%I::text) in (''quiet creek residents'', ''traverze culture'')', column_name);
      end if;
    end loop;

    if match_sql <> '' then
      execute format(
        'insert into _loombus_legacy_room_cleanup_ids (source_table, room_id) select %L, id::text from public.%I where %s',
        room_table,
        room_table,
        match_sql
      );
    end if;
  end loop;

  foreach room_table in array array['room_posts', 'room_messages', 'room_discussions', 'loombus_room_posts', 'room_events', 'loombus_room_events', 'community_room_events', 'room_members', 'room_memberships', 'loombus_room_members', 'community_room_members'] loop
    if to_regclass('public.' || room_table) is not null and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = room_table and column_name = 'room_id'
    ) then
      execute format(
        'delete from public.%I where room_id::text in (select room_id from _loombus_legacy_room_cleanup_ids)',
        room_table
      );
    end if;
  end loop;

  foreach room_table in array array['rooms', 'loombus_rooms', 'community_rooms'] loop
    if to_regclass('public.' || room_table) is not null and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = room_table and column_name = 'id'
    ) then
      execute format(
        'delete from public.%I where id::text in (select room_id from _loombus_legacy_room_cleanup_ids where source_table = %L)',
        room_table,
        room_table
      );
    end if;
  end loop;
end $$;
