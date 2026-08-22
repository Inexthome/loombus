-- Loombus Library Knowledge Graph persistent workspace foundation.
--
-- Adds member-private, cross-device storage for named graph workspaces and saved
-- path configurations. These tables store investigation configuration only; the
-- existing Library relational/provenance tables remain the source of truth for
-- nodes, edges, and relationship direction.

create table if not exists public.library_graph_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_graph_workspaces_name_check check (
    char_length(btrim(name)) between 1 and 80
  ),
  constraint library_graph_workspaces_description_check check (
    description is null or char_length(description) <= 500
  )
);

create unique index if not exists library_graph_workspaces_user_name_unique_idx
  on public.library_graph_workspaces(user_id, lower(btrim(name)));

create index if not exists library_graph_workspaces_user_updated_idx
  on public.library_graph_workspaces(user_id, updated_at desc);

create table if not exists public.library_graph_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.library_graph_workspaces(id) on delete set null,
  name text not null,
  start_node_key text not null,
  target_node_key text not null,
  max_hops smallint not null default 4,
  direction_mode text not null default 'either',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_graph_saved_views_name_check check (
    char_length(btrim(name)) between 1 and 100
  ),
  constraint library_graph_saved_views_start_key_check check (
    start_node_key ~ '^(publication|claim|knowledge|discussion):[0-9a-fA-F-]{36}$'
  ),
  constraint library_graph_saved_views_target_key_check check (
    target_node_key ~ '^(publication|claim|knowledge|discussion):[0-9a-fA-F-]{36}$'
  ),
  constraint library_graph_saved_views_distinct_nodes_check check (
    start_node_key <> target_node_key
  ),
  constraint library_graph_saved_views_hops_check check (
    max_hops between 2 and 5
  ),
  constraint library_graph_saved_views_direction_check check (
    direction_mode in ('either', 'recorded')
  )
);

create unique index if not exists library_graph_saved_views_user_name_unique_idx
  on public.library_graph_saved_views(user_id, lower(btrim(name)));

create index if not exists library_graph_saved_views_user_updated_idx
  on public.library_graph_saved_views(user_id, updated_at desc);

create index if not exists library_graph_saved_views_workspace_updated_idx
  on public.library_graph_saved_views(workspace_id, updated_at desc)
  where workspace_id is not null;

alter table public.library_graph_workspaces enable row level security;
alter table public.library_graph_saved_views enable row level security;

drop policy if exists "members read own library graph workspaces" on public.library_graph_workspaces;
create policy "members read own library graph workspaces"
  on public.library_graph_workspaces
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members create own library graph workspaces" on public.library_graph_workspaces;
create policy "members create own library graph workspaces"
  on public.library_graph_workspaces
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "members update own library graph workspaces" on public.library_graph_workspaces;
create policy "members update own library graph workspaces"
  on public.library_graph_workspaces
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "members delete own library graph workspaces" on public.library_graph_workspaces;
create policy "members delete own library graph workspaces"
  on public.library_graph_workspaces
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members read own library graph saved views" on public.library_graph_saved_views;
create policy "members read own library graph saved views"
  on public.library_graph_saved_views
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members create own library graph saved views" on public.library_graph_saved_views;
create policy "members create own library graph saved views"
  on public.library_graph_saved_views
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      workspace_id is null
      or exists (
        select 1
        from public.library_graph_workspaces workspace
        where workspace.id = library_graph_saved_views.workspace_id
          and workspace.user_id = auth.uid()
      )
    )
  );

drop policy if exists "members update own library graph saved views" on public.library_graph_saved_views;
create policy "members update own library graph saved views"
  on public.library_graph_saved_views
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      workspace_id is null
      or exists (
        select 1
        from public.library_graph_workspaces workspace
        where workspace.id = library_graph_saved_views.workspace_id
          and workspace.user_id = auth.uid()
      )
    )
  );

drop policy if exists "members delete own library graph saved views" on public.library_graph_saved_views;
create policy "members delete own library graph saved views"
  on public.library_graph_saved_views
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.library_graph_workspaces from anon;
revoke all on table public.library_graph_saved_views from anon;
revoke all on table public.library_graph_workspaces from authenticated;
revoke all on table public.library_graph_saved_views from authenticated;

grant select, insert, update, delete on table public.library_graph_workspaces to authenticated;
grant select, insert, update, delete on table public.library_graph_saved_views to authenticated;

comment on table public.library_graph_workspaces is
  'Member-private named Knowledge Graph investigation workspaces. Configuration only; graph truth remains in existing Library provenance tables.';
comment on table public.library_graph_saved_views is
  'Member-private cross-device saved Knowledge Graph path configurations. Stored node keys are navigation configuration, not inferred graph relationships.';
