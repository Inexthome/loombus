from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"Missing hardening target: {label}")
    return source.replace(old, new, 1)


# Harden database privacy invariants and make policy creation rerunnable.
path = Path("supabase/migrations/20260725013000_enforce_customer_support_thread_isolation.sql")
source = path.read_text()
source = replace_once(
    source,
    """create or replace function public.enforce_room_post_required_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  required_scope text;
begin
  select case
    when room.room_type = 'customer_support' then 'author_and_staff'
    else 'room'
  end
  into required_scope
  from public.rooms room
  where room.id = new.room_id;

  if required_scope is null then
    raise exception using
      errcode = '23503',
      message = 'The Room does not exist.';
  end if;

  new.visibility_scope := required_scope;
  return new;
end;
$$;
""",
    """create or replace function public.enforce_room_post_required_visibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_room_type text;
begin
  select room.room_type
  into target_room_type
  from public.rooms room
  where room.id = new.room_id;

  if target_room_type is null then
    raise exception using
      errcode = '23503',
      message = 'The Room does not exist.';
  end if;

  if target_room_type = 'customer_support' then
    new.visibility_scope := 'author_and_staff';
  elsif tg_op = 'INSERT' then
    new.visibility_scope := 'room';
  elsif old.visibility_scope = 'author_and_staff' then
    -- Never widen an existing private case because of a later record update.
    new.visibility_scope := 'author_and_staff';
  else
    new.visibility_scope := 'room';
  end if;

  return new;
end;
$$;
""",
    "required thread visibility trigger",
)
source = replace_once(
    source,
    """create or replace function public.reconcile_room_post_visibility_after_type_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.room_type is distinct from new.room_type then
    update public.room_posts
    set visibility_scope = case
      when new.room_type = 'customer_support' then 'author_and_staff'
      else 'room'
    end
    where room_id = new.id;
  end if;
  return new;
end;
$$;
""",
    """create or replace function public.reconcile_room_post_visibility_after_type_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.room_type = 'customer_support'
     and new.room_type is distinct from 'customer_support' then
    raise exception using
      errcode = '23514',
      message = 'Customer Support Rooms cannot be converted to a shared Room type.';
  end if;

  if old.room_type is distinct from 'customer_support'
     and new.room_type = 'customer_support' then
    update public.room_posts
    set visibility_scope = 'author_and_staff'
    where room_id = new.id;
  end if;

  return new;
end;
$$;
""",
    "Room type privacy transition",
)

policy_drop_pairs = [
    (
        'drop policy if exists "Live room posts are visible inside the room"\n  on public.room_posts;\n',
        'drop policy if exists "Authorized members can read Room discussions"\n  on public.room_posts;\n'
        'drop policy if exists "Live room posts are visible inside the room"\n  on public.room_posts;\n',
        "Room post policy rerun",
    ),
    (
        'drop policy if exists "Room replies are visible to active members"\n  on public.room_post_replies;\n',
        'drop policy if exists "Authorized members can read Room replies"\n  on public.room_post_replies;\n'
        'drop policy if exists "Room replies are visible to active members"\n  on public.room_post_replies;\n',
        "Room reply policy rerun",
    ),
    (
        'drop policy if exists "Members can read their Room thread markers"\n  on public.room_post_reads;\n',
        'drop policy if exists "Members can read authorized Room thread markers"\n  on public.room_post_reads;\n'
        'drop policy if exists "Members can read their Room thread markers"\n  on public.room_post_reads;\n',
        "read marker select policy rerun",
    ),
    (
        'drop policy if exists "Members can create their Room thread markers"\n  on public.room_post_reads;\n',
        'drop policy if exists "Members can create authorized Room thread markers"\n  on public.room_post_reads;\n'
        'drop policy if exists "Members can create their Room thread markers"\n  on public.room_post_reads;\n',
        "read marker insert policy rerun",
    ),
    (
        'drop policy if exists "Members can update their Room thread markers"\n  on public.room_post_reads;\n',
        'drop policy if exists "Members can update authorized Room thread markers"\n  on public.room_post_reads;\n'
        'drop policy if exists "Members can update their Room thread markers"\n  on public.room_post_reads;\n',
        "read marker update policy rerun",
    ),
    (
        'create policy "Authorized members can read support-case participants"\n',
        'drop policy if exists "Authorized members can read support-case participants"\n  on public.room_post_participants;\n'
        'create policy "Authorized members can read support-case participants"\n',
        "participant policy rerun",
    ),
    (
        'drop policy if exists "Room members can read post attachments"\n  on public.room_post_attachments;\n',
        'drop policy if exists "Authorized members can read post attachments"\n  on public.room_post_attachments;\n'
        'drop policy if exists "Room members can read post attachments"\n  on public.room_post_attachments;\n',
        "attachment select policy rerun",
    ),
    (
        'drop policy if exists "Room members can create post attachments"\n  on public.room_post_attachments;\n',
        'drop policy if exists "Authorized members can create post attachments"\n  on public.room_post_attachments;\n'
        'drop policy if exists "Room members can create post attachments"\n  on public.room_post_attachments;\n',
        "attachment insert policy rerun",
    ),
    (
        'drop policy if exists "Uploaders and room owners can delete post attachments"\n  on public.room_post_attachments;\n',
        'drop policy if exists "Uploaders and Room staff can delete post attachments"\n  on public.room_post_attachments;\n'
        'drop policy if exists "Uploaders and room owners can delete post attachments"\n  on public.room_post_attachments;\n',
        "attachment delete policy rerun",
    ),
    (
        'drop policy if exists "Room members can read uploaded post files"\n  on storage.objects;\n',
        'drop policy if exists "Authorized members can read uploaded post files"\n  on storage.objects;\n'
        'drop policy if exists "Room members can read uploaded post files"\n  on storage.objects;\n',
        "storage select policy rerun",
    ),
    (
        'drop policy if exists "Room members can upload post files"\n  on storage.objects;\n',
        'drop policy if exists "Authorized members can upload post files"\n  on storage.objects;\n'
        'drop policy if exists "Room members can upload post files"\n  on storage.objects;\n',
        "storage insert policy rerun",
    ),
    (
        'drop policy if exists "Uploaders can manage uploaded post files"\n  on storage.objects;\n',
        'drop policy if exists "Uploaders and Room staff can manage uploaded post files"\n  on storage.objects;\n'
        'drop policy if exists "Uploaders can manage uploaded post files"\n  on storage.objects;\n',
        "storage delete policy rerun",
    ),
]
for old, new, label in policy_drop_pairs:
    source = replace_once(source, old, new, label)
path.write_text(source)


# Align service-role authorization, suspension handling, and UI permissions.
path = Path("src/app/api/rooms/[roomId]/discussions/route.ts")
source = path.read_text()
source = replace_once(
    source,
    """function normalizedTimestamp(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
""",
    """function normalizedTimestamp(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function roomMembershipIsActive(row: RoomRow) {
  if (
    ["blocked", "removed", "inactive"].includes(
      asString(row.status).toLowerCase()
    )
  ) {
    return false;
  }
  const suspendedUntil = normalizedTimestamp(row.suspended_until);
  return (
    !suspendedUntil || new Date(suspendedUntil).getTime() <= Date.now()
  );
}
""",
    "active Room membership helper",
)
source = replace_once(
    source,
    """  const result = await service
    .from("room_members")
    .select("user_id, role, status")
    .eq("room_id", access.room.id)
    .in("role", ["owner", "admin", "administrator", "moderator"])
    .not("status", "in", "(blocked,removed,inactive)")
    .limit(500);
  if (result.error) throw new Error(result.error.message);

  return [
    ...new Set([
      access.room.ownerId,
      access.room.createdBy,
      ...((result.data ?? []) as RoomRow[]).map((row) =>
        asString(row.user_id)
      ),
    ].filter(Boolean)),
  ];
""",
    """  const result = await service
    .from("room_members")
    .select("user_id, role, status, suspended_until")
    .eq("room_id", access.room.id)
    .in("role", ["owner", "admin", "administrator", "moderator"])
    .not("status", "in", "(blocked,removed,inactive)")
    .limit(500);
  if (result.error) throw new Error(result.error.message);

  const activeStaffIds = ((result.data ?? []) as RoomRow[])
    .filter(roomMembershipIsActive)
    .map((row) => asString(row.user_id))
    .filter(Boolean);

  return [
    ...new Set(
      [access.room.ownerId, access.room.createdBy, ...activeStaffIds].filter(
        Boolean
      )
    ),
  ];
""",
    "active support staff filtering",
)
source = replace_once(
    source,
    """  const result = await service
    .from("room_members")
    .select("user_id, status")
    .eq("room_id", access.room.id)
    .in("user_id", candidates);
  if (result.error) throw new Error(result.error.message);

  const active = new Set(
    ((result.data ?? []) as RoomRow[])
      .filter(
        (row) =>
          !["blocked", "removed", "inactive"].includes(
            asString(row.status).toLowerCase()
          )
      )
      .map((row) => asString(row.user_id))
      .filter(Boolean)
  );
""",
    """  const result = await service
    .from("room_members")
    .select("user_id, status, suspended_until")
    .eq("room_id", access.room.id)
    .in("user_id", candidates);
  if (result.error) throw new Error(result.error.message);

  const active = new Set(
    ((result.data ?? []) as RoomRow[])
      .filter(roomMembershipIsActive)
      .map((row) => asString(row.user_id))
      .filter(Boolean)
  );
""",
    "active participant filtering",
)
source = replace_once(
    source,
    """      const candidateResult = await service
        .from("room_members")
        .select("user_id, role, status")
        .eq("room_id", roomId)
        .not("status", "in", "(blocked,removed,inactive)")
        .order("created_at", { ascending: true })
        .limit(500);
      if (candidateResult.error) throw new Error(candidateResult.error.message);
      candidateRows = (candidateResult.data ?? []) as RoomRow[];
""",
    """      const candidateResult = await service
        .from("room_members")
        .select("user_id, role, status, suspended_until")
        .eq("room_id", roomId)
        .not("status", "in", "(blocked,removed,inactive)")
        .order("created_at", { ascending: true })
        .limit(500);
      if (candidateResult.error) throw new Error(candidateResult.error.message);
      candidateRows = ((candidateResult.data ?? []) as RoomRow[]).filter(
        roomMembershipIsActive
      );
""",
    "active participant candidate filtering",
)
source = replace_once(
    source,
    """      if (asString(post.author_id) !== userId && !access.canManage) {
        return jsonError(
          "Only the discussion author or Room management can change its status.",
          403
        );
      }
""",
    """      const canChangeStatus =
        asString(post.author_id) === userId ||
        (isCustomerSupportRoomType(access.room.roomType)
          ? access.canModerate
          : access.canManage);
      if (!canChangeStatus) {
        return jsonError(
          "Only the discussion author or authorized Room staff can change its status.",
          403
        );
      }
""",
    "support case resolve authorization",
)
source = replace_once(
    source,
    """          discussionType: mode,
           discussionMetadata: asMetadata(row.discussion_metadata),
           visibilityScope:
             asString(row.visibility_scope) === "author_and_staff"
               ? "author_and_staff"
               : "room",
           status: asString(row.status) === "resolved" ? "resolved" : "open",
""",
    """          discussionType: mode,
          discussionMetadata: asMetadata(row.discussion_metadata),
          visibilityScope:
            asString(row.visibility_scope) === "author_and_staff"
              ? "author_and_staff"
              : "room",
          status: asString(row.status) === "resolved" ? "resolved" : "open",
""",
    "thread response formatting",
)
source = replace_once(
    source,
    """        metadata: {
          room_id: roomId,
           discussion_type: modeResult.mode,
           visibility_scope: getRequiredRoomThreadVisibility(
             access.room.roomType
           ),
         },
""",
    """        metadata: {
          room_id: roomId,
          discussion_type: modeResult.mode,
          visibility_scope: getRequiredRoomThreadVisibility(
            access.room.roomType
          ),
        },
""",
    "discussion audit formatting",
)
path.write_text(source)
