from pathlib import Path


def replace_once(source: str, old: str, new: str, label: str) -> str:
    if old not in source:
        raise RuntimeError(f"Missing patch target: {label}")
    return source.replace(old, new, 1)


def write(path: str, source: str) -> None:
    Path(path).write_text(source)


# Fix the remaining inherited-key plan validator while this billing file is touched.
path = "src/lib/room-billing.ts"
source = Path(path).read_text()
source = replace_once(
    source,
    'export function isPaidRoomPlanKey(value: string): value is PaidRoomPlanKey {\n  return value in PAID_ROOM_PLANS;\n}',
    'export function isPaidRoomPlanKey(value: string): value is PaidRoomPlanKey {\n  return Object.prototype.hasOwnProperty.call(PAID_ROOM_PLANS, value);\n}',
    "paid Room plan validator",
)
write(path, source)


# Make Room required behaviors explicit in the product model and restore support copy.
path = "src/app/rooms/rooms-v2-model.ts"
source = Path(path).read_text()
source = replace_once(
    source,
    '} from "@/lib/room-plan-entitlements";\n',
    '} from "@/lib/room-plan-entitlements";\nimport type { RoomRequiredBehavior } from "@/lib/room-required-behaviors";\n',
    "Room model behavior import",
)
source = replace_once(
    source,
    '  examples: string[];\n  calendarUse: string;\n',
    '  examples: string[];\n  calendarUse: string;\n  requiredBehaviors: readonly RoomRequiredBehavior[];\n',
    "Room model behavior type",
)
for calendar_line in [
    '    calendarUse: "Milestones, meetings, deadlines, launches, and internal events",\n',
    '    calendarUse: "Meetings, inspections, maintenance windows, and community events",\n',
    '    calendarUse: "Due dates, class sessions, office hours, and presentations",\n',
    '    calendarUse: "Gatherings, volunteer dates, meetings, and shared milestones",\n',
]:
    source = replace_once(
        source,
        calendar_line,
        calendar_line + '    requiredBehaviors: [],\n',
        f"Room model empty behaviors: {calendar_line.strip()}",
    )
source = replace_once(
    source,
    '    title: "Customer Community Room",\n    shortTitle: "Customer Community",\n    description:\n      "A shared customer community for known issues, help resources, product questions, requests, and updates. Active Room members can see shared discussions.",\n    audience: "Businesses, service providers, product teams, and customer communities",\n    examples: ["Known issues", "Shared product questions", "Product updates"],\n    calendarUse: "Maintenance windows, onboarding sessions, releases, and training",\n',
    '    title: "Customer Support Room",\n    shortTitle: "Customer Support",\n    description:\n      "A private support space where each customer case is visible only to its author, Room support staff, and explicitly added participants.",\n    audience: "Businesses, service providers, product teams, and client support groups",\n    examples: ["Private support cases", "Known issues", "Product updates"],\n    calendarUse: "Maintenance windows, onboarding sessions, releases, and training",\n    requiredBehaviors: ["private_support_threads"],\n',
    "Customer Support model copy",
)
write(path, source)


# Enforce required settings and expose behavior metadata through the module API.
path = "src/app/api/rooms/[roomId]/modules/route.ts"
source = Path(path).read_text()
source = replace_once(
    source,
    'import { logAuditEvent } from "@/lib/audit-log";\n',
    'import { logAuditEvent } from "@/lib/audit-log";\nimport {\n  getRoomRequiredBehaviors,\n  isCustomerSupportRoomType,\n} from "@/lib/room-required-behaviors";\n',
    "module behavior imports",
)
source = replace_once(
    source,
    'function normalizeSettings(value: unknown): RoomModuleSettings {\n',
    'function normalizeSettings(\n  value: unknown,\n  roomType?: unknown\n): RoomModuleSettings {\n',
    "settings normalizer signature",
)
source = replace_once(
    source,
    '    allowMemberPosts:\n      typeof source.allowMemberPosts === "boolean"\n        ? source.allowMemberPosts\n        : DEFAULT_SETTINGS.allowMemberPosts,\n',
    '    allowMemberPosts: isCustomerSupportRoomType(roomType)\n      ? true\n      : typeof source.allowMemberPosts === "boolean"\n        ? source.allowMemberPosts\n        : DEFAULT_SETTINGS.allowMemberPosts,\n',
    "required support posting setting",
)
source = replace_once(
    source,
    'async function getSettings(service: ServiceClient, roomId: string) {\n',
    'async function getSettings(\n  service: ServiceClient,\n  roomId: string,\n  roomType?: unknown\n) {\n',
    "settings loader signature",
)
source = replace_once(
    source,
    '  return normalizeSettings((result.data as RoomRow | null)?.settings);\n',
    '  return normalizeSettings(\n    (result.data as RoomRow | null)?.settings,\n    roomType\n  );\n',
    "settings loader behavior",
)
source = source.replace(
    'getSettings(service, roomId)',
    'getSettings(service, roomId, access.room.roomType)',
)
source = source.replace(
    'getSettings(serviceSupabase, roomId)',
    'getSettings(serviceSupabase, roomId, access.room.roomType)',
)
source = source.replace(
    '        room: access.room,\n',
    '        room: {\n          ...access.room,\n          requiredBehaviors: getRoomRequiredBehaviors(access.room.roomType),\n        },\n',
)
source = replace_once(
    source,
    '      const settings = normalizeSettings({\n        ...(await getSettings(serviceSupabase, roomId, access.room.roomType)),\n        ...asObject(body?.settings),\n      });\n',
    '      const settings = normalizeSettings(\n        {\n          ...(await getSettings(\n            serviceSupabase,\n            roomId,\n            access.room.roomType\n          )),\n          ...asObject(body?.settings),\n        },\n        access.room.roomType\n      );\n',
    "settings update behavior",
)
write(path, source)


# Make the non-toggleable behavior visible in Settings.
path = "src/components/room-tier-modules-workspace.tsx"
source = Path(path).read_text()
source = replace_once(
    source,
    '    memberLimit: number | null;\n  };\n',
    '    memberLimit: number | null;\n    roomType?: string;\n    requiredBehaviors?: string[];\n  };\n',
    "manifest Room behavior type",
)
source = replace_once(
    source,
    '    room?: { name?: string; description?: string; inviteOnly?: boolean };\n',
    '    room?: {\n      name?: string;\n      description?: string;\n      inviteOnly?: boolean;\n      roomType?: string;\n      requiredBehaviors?: string[];\n    };\n',
    "settings Room behavior type",
)
source = replace_once(
    source,
    '  const [working, setWorking] = useState(false);\n\n  useEffect(() => {\n',
    '  const [working, setWorking] = useState(false);\n  const privateSupportThreads = Boolean(\n    source.room?.requiredBehaviors?.includes("private_support_threads") ||\n      source.room?.roomType === "customer_support"\n  );\n\n  useEffect(() => {\n',
    "settings required behavior state",
)
source = replace_once(
    source,
    '    setAllowMemberPosts(source.settings?.allowMemberPosts ?? true);\n',
    '    setAllowMemberPosts(\n      privateSupportThreads ? true : source.settings?.allowMemberPosts ?? true\n    );\n',
    "settings required behavior hydration",
)
source = replace_once(
    source,
    '        allowMemberPosts,\n',
    '        allowMemberPosts: privateSupportThreads ? true : allowMemberPosts,\n',
    "settings required behavior submit",
)
source = replace_once(
    source,
    '          <label className="room-tier-checkbox"><input type="checkbox" checked={allowMemberPosts} onChange={(event) => setAllowMemberPosts(event.target.checked)} /><span>Allow ordinary members to create discussions</span></label>\n',
    '          <label className="room-tier-checkbox">\n            <input\n              type="checkbox"\n              checked={privateSupportThreads ? true : allowMemberPosts}\n              disabled={privateSupportThreads}\n              onChange={(event) => setAllowMemberPosts(event.target.checked)}\n            />\n            <span>\n              {privateSupportThreads\n                ? "Customers can always open and reply to their private support cases"\n                : "Allow ordinary members to create discussions"}\n            </span>\n          </label>\n          {privateSupportThreads ? (\n            <p className="rooms-live-notice">\n              This is a required Customer Support behavior. It cannot be disabled.\n            </p>\n          ) : null}\n',
    "settings required behavior control",
)
write(path, source)


# Enforce support-case filtering and participant controls in the service-role API.
path = "src/app/api/rooms/[roomId]/discussions/route.ts"
source = Path(path).read_text()
source = replace_once(
    source,
    'import { createNotifications } from "@/lib/notifications";\n',
    'import { createNotifications } from "@/lib/notifications";\nimport {\n  getRequiredRoomThreadVisibility,\n  getRoomRequiredBehaviors,\n  isCustomerSupportRoomType,\n} from "@/lib/room-required-behaviors";\n',
    "discussion behavior imports",
)
source = replace_once(
    source,
    'function canParticipate(access: RoomAccess, memberPostsAllowed: boolean) {\n  return memberPostsAllowed || access.canModerate;\n}\n',
    'function canParticipate(access: RoomAccess, memberPostsAllowed: boolean) {\n  return (\n    isCustomerSupportRoomType(access.room.roomType) ||\n    memberPostsAllowed ||\n    access.canModerate\n  );\n}\n\nasync function loadSupportStaffIds(\n  service: ServiceClient,\n  access: RoomAccess\n) {\n  const result = await service\n    .from("room_members")\n    .select("user_id, role, status")\n    .eq("room_id", access.room.id)\n    .in("role", ["owner", "admin", "administrator", "moderator"])\n    .not("status", "in", "(blocked,removed,inactive)")\n    .limit(500);\n  if (result.error) throw new Error(result.error.message);\n\n  return [\n    ...new Set([\n      access.room.ownerId,\n      access.room.createdBy,\n      ...((result.data ?? []) as RoomRow[]).map((row) =>\n        asString(row.user_id)\n      ),\n    ].filter(Boolean)),\n  ];\n}\n\nasync function postIsAccessible(\n  service: ServiceClient,\n  access: RoomAccess,\n  post: RoomRow,\n  userId: string\n) {\n  const visibility = asString(post.visibility_scope) || "room";\n  if (visibility === "room") return access.allowed;\n  if (asString(post.author_id) === userId || access.canModerate) return true;\n\n  const participant = await service\n    .from("room_post_participants")\n    .select("post_id")\n    .eq("post_id", asString(post.id))\n    .eq("room_id", access.room.id)\n    .eq("user_id", userId)\n    .maybeSingle();\n  if (participant.error) throw new Error(participant.error.message);\n  return Boolean(participant.data);\n}\n\nasync function loadAccessiblePost(\n  service: ServiceClient,\n  access: RoomAccess,\n  roomId: string,\n  postId: string,\n  userId: string\n) {\n  const post = await loadPost(service, roomId, postId);\n  if (!post) return null;\n  return (await postIsAccessible(service, access, post, userId)) ? post : null;\n}\n\nasync function notifySupportStaffOfNewCase({\n  service,\n  access,\n  postId,\n  title,\n  actorId,\n}: {\n  service: ServiceClient;\n  access: RoomAccess;\n  postId: string;\n  title: string;\n  actorId: string;\n}) {\n  if (!isCustomerSupportRoomType(access.room.roomType)) return;\n  const staffIds = await loadSupportStaffIds(service, access).catch(() => []);\n  const recipients = staffIds.filter((userId) => userId !== actorId);\n  if (recipients.length === 0) return;\n  const { error } = await createNotifications(\n    recipients.map((userId) => ({\n      user_id: userId,\n      actor_id: actorId,\n      type: "room_support_case",\n      target_type: "room_post",\n      target_id: postId,\n      message: `New support case in ${access.room.name}: ${title}`,\n    }))\n  );\n  if (error) {\n    console.error("Room support-case notifications failed:", error.message);\n  }\n}\n',
    "discussion access helpers",
)
source = replace_once(
    source,
    '  const candidates = [\n    asString(post.author_id),\n    ...((replyAuthors.data ?? []) as RoomRow[]).map((row) =>\n      asString(row.author_id)\n    ),\n  ].filter((userId) => userId && userId !== actorId);\n',
    '  const privateSupportThreads = isCustomerSupportRoomType(\n    access.room.roomType\n  );\n  const participantResult = privateSupportThreads\n    ? await service\n        .from("room_post_participants")\n        .select("user_id")\n        .eq("post_id", postId)\n    : { data: [], error: null };\n  if (participantResult.error) {\n    console.error(\n      "Room support participant lookup failed:",\n      participantResult.error.message\n    );\n  }\n  const staffIds = privateSupportThreads\n    ? await loadSupportStaffIds(service, access).catch(() => [])\n    : [];\n\n  const candidates = [\n    asString(post.author_id),\n    ...((replyAuthors.data ?? []) as RoomRow[]).map((row) =>\n      asString(row.author_id)\n    ),\n    ...((participantResult.data ?? []) as RoomRow[]).map((row) =>\n      asString(row.user_id)\n    ),\n    ...staffIds,\n  ].filter((userId) => userId && userId !== actorId);\n',
    "support reply notification recipients",
)
source = replace_once(
    source,
    '    const memberPostsAllowed = await memberPostsAreAllowed(service, roomId);\n    const postsResult = await service\n      .from("room_posts")\n      .select(\n        "id, room_id, author_id, title, body, discussion_type, discussion_metadata, status, resolved_at, resolved_by, last_activity_at, reply_count, created_at, updated_at"\n      )\n      .eq("room_id", roomId)\n      .is("deleted_at", null)\n      .order("last_activity_at", { ascending: false })\n      .limit(POST_LIMIT);\n',
    '    const memberPostsAllowed = await memberPostsAreAllowed(service, roomId);\n    const privateSupportThreads = isCustomerSupportRoomType(\n      access.room.roomType\n    );\n    let accessibleParticipantPostIds: string[] = [];\n    if (privateSupportThreads && !access.canModerate) {\n      const participantLookup = await service\n        .from("room_post_participants")\n        .select("post_id")\n        .eq("room_id", roomId)\n        .eq("user_id", userId)\n        .limit(POST_LIMIT);\n      if (participantLookup.error) {\n        throw new Error(participantLookup.error.message);\n      }\n      accessibleParticipantPostIds = (\n        (participantLookup.data ?? []) as RoomRow[]\n      )\n        .map((row) => asString(row.post_id))\n        .filter(Boolean);\n    }\n\n    let postsQuery = service\n      .from("room_posts")\n      .select(\n        "id, room_id, author_id, title, body, discussion_type, discussion_metadata, visibility_scope, status, resolved_at, resolved_by, last_activity_at, reply_count, created_at, updated_at"\n      )\n      .eq("room_id", roomId)\n      .is("deleted_at", null);\n    if (privateSupportThreads && !access.canModerate) {\n      const accessClauses = [`author_id.eq.${userId}`];\n      if (accessibleParticipantPostIds.length > 0) {\n        accessClauses.push(\n          `id.in.(${accessibleParticipantPostIds.join(",")})`\n        );\n      }\n      postsQuery = postsQuery.or(accessClauses.join(","));\n    }\n    const postsResult = await postsQuery\n      .order("last_activity_at", { ascending: false })\n      .limit(POST_LIMIT);\n',
    "support GET filtering",
)
source = replace_once(
    source,
    '    const [repliesResult, readsResult] = await Promise.all([\n',
    '    const [repliesResult, readsResult, participantsResult] = await Promise.all([\n',
    "participant GET promise",
)
source = replace_once(
    source,
    '      postIds.length\n        ? service\n            .from("room_post_reads")\n            .select("post_id, last_read_at")\n            .eq("room_id", roomId)\n            .eq("user_id", userId)\n            .in("post_id", postIds)\n        : Promise.resolve({ data: [], error: null }),\n    ]);\n',
    '      postIds.length\n        ? service\n            .from("room_post_reads")\n            .select("post_id, last_read_at")\n            .eq("room_id", roomId)\n            .eq("user_id", userId)\n            .in("post_id", postIds)\n        : Promise.resolve({ data: [], error: null }),\n      privateSupportThreads && postIds.length\n        ? service\n            .from("room_post_participants")\n            .select("post_id, user_id, added_by, created_at")\n            .eq("room_id", roomId)\n            .in("post_id", postIds)\n            .order("created_at", { ascending: true })\n        : Promise.resolve({ data: [], error: null }),\n    ]);\n',
    "participant GET query",
)
source = replace_once(
    source,
    '    if (repliesResult.error || readsResult.error) {\n',
    '    if (repliesResult.error || readsResult.error || participantsResult.error) {\n',
    "participant GET error",
)
source = replace_once(
    source,
    '          readsResult.error?.message ||\n          "Room discussion activity could not be loaded.",\n',
    '          readsResult.error?.message ||\n          participantsResult.error?.message ||\n          "Room discussion activity could not be loaded.",\n',
    "participant GET error message",
)
source = replace_once(
    source,
    '    const replyRows = (repliesResult.data ?? []) as RoomRow[];\n    const profiles = await loadProfiles(service, [\n',
    '    const replyRows = (repliesResult.data ?? []) as RoomRow[];\n    const participantRows = (participantsResult.data ?? []) as RoomRow[];\n    let candidateRows: RoomRow[] = [];\n    if (privateSupportThreads && access.canModerate) {\n      const candidateResult = await service\n        .from("room_members")\n        .select("user_id, role, status")\n        .eq("room_id", roomId)\n        .not("status", "in", "(blocked,removed,inactive)")\n        .order("created_at", { ascending: true })\n        .limit(500);\n      if (candidateResult.error) throw new Error(candidateResult.error.message);\n      candidateRows = (candidateResult.data ?? []) as RoomRow[];\n    }\n    const profiles = await loadProfiles(service, [\n',
    "participant profile rows",
)
source = replace_once(
    source,
    '      ...postRows.map((row) => asString(row.resolved_by)),\n    ]);\n',
    '      ...postRows.map((row) => asString(row.resolved_by)),\n      ...participantRows.map((row) => asString(row.user_id)),\n      ...participantRows.map((row) => asString(row.added_by)),\n      ...candidateRows.map((row) => asString(row.user_id)),\n      access.room.ownerId,\n      access.room.createdBy,\n    ]);\n',
    "participant profile ids",
)
source = replace_once(
    source,
    '    const repliesByPost = new Map<string, RoomRow[]>();\n',
    '    const participantsByPost = new Map<string, RoomRow[]>();\n    for (const participant of participantRows) {\n      const postId = asString(participant.post_id);\n      participantsByPost.set(postId, [\n        ...(participantsByPost.get(postId) ?? []),\n        participant,\n      ]);\n    }\n    const repliesByPost = new Map<string, RoomRow[]>();\n',
    "participant map",
)
source = replace_once(
    source,
    '      room: {\n        id: access.room.id,\n        name: access.room.name,\n      },\n',
    '      room: {\n        id: access.room.id,\n        name: access.room.name,\n        roomType: access.room.roomType,\n        requiredBehaviors: getRoomRequiredBehaviors(access.room.roomType),\n        threadVisibilityScope: getRequiredRoomThreadVisibility(\n          access.room.roomType\n        ),\n      },\n',
    "discussion Room behavior response",
)
source = replace_once(
    source,
    '        canModerate: access.canModerate,\n        memberPostsAllowed,\n      },\n      posts: postRows.map((row) => {\n',
    '        canModerate: access.canModerate,\n        canManageParticipants: privateSupportThreads && access.canModerate,\n        memberPostsAllowed: privateSupportThreads ? true : memberPostsAllowed,\n      },\n      participantCandidates:\n        privateSupportThreads && access.canModerate\n          ? candidateRows.map((row) => {\n              const candidateUserId = asString(row.user_id);\n              const role = asString(row.role) || "member";\n              return {\n                userId: candidateUserId,\n                role,\n                isStaff: [\n                  "owner",\n                  "admin",\n                  "administrator",\n                  "moderator",\n                ].includes(role),\n                profile: profileFor(profiles, candidateUserId),\n              };\n            })\n          : [],\n      posts: postRows.map((row) => {\n',
    "participant candidate response",
)
source = replace_once(
    source,
    '           discussionMetadata: asMetadata(row.discussion_metadata),\n           status: asString(row.status) === "resolved" ? "resolved" : "open",\n',
    '           discussionMetadata: asMetadata(row.discussion_metadata),\n           visibilityScope:\n             asString(row.visibility_scope) === "author_and_staff"\n               ? "author_and_staff"\n               : "room",\n           status: asString(row.status) === "resolved" ? "resolved" : "open",\n',
    "thread visibility response",
)
source = replace_once(
    source,
    '          canResolve: authorId === userId || access.canManage,\n          canDelete: authorId === userId || access.canModerate,\n          replies: (repliesByPost.get(postId) ?? []).map((reply) => {\n',
    '          canResolve:\n            authorId === userId ||\n            (privateSupportThreads ? access.canModerate : access.canManage),\n          canDelete: authorId === userId || access.canModerate,\n          canManageParticipants: privateSupportThreads && access.canModerate,\n          participants: (participantsByPost.get(postId) ?? []).map(\n            (participant) => {\n              const participantUserId = asString(participant.user_id);\n              const addedBy = asString(participant.added_by);\n              return {\n                userId: participantUserId,\n                profile: profileFor(profiles, participantUserId),\n                addedBy,\n                addedByProfile: profileFor(profiles, addedBy),\n                createdAt: normalizedTimestamp(participant.created_at),\n              };\n            }\n          ),\n          replies: (repliesByPost.get(postId) ?? []).map((reply) => {\n',
    "thread participant response",
)
source = replace_once(
    source,
    '          discussion_metadata: modeResult.metadata,\n          status: "open",\n',
    '          discussion_metadata: modeResult.metadata,\n          visibility_scope: getRequiredRoomThreadVisibility(\n            access.room.roomType\n          ),\n          status: "open",\n',
    "required visibility insert",
)
source = replace_once(
    source,
    '      await logAuditEvent({\n        actor_id: userId,\n        action: "room.discussion_created",\n',
    '      await notifySupportStaffOfNewCase({\n        service,\n        access,\n        postId,\n        title,\n        actorId: userId,\n      });\n      await logAuditEvent({\n        actor_id: userId,\n        action: "room.discussion_created",\n',
    "new support case notifications",
)
source = replace_once(
    source,
    '           discussion_type: modeResult.mode,\n         },\n',
    '           discussion_type: modeResult.mode,\n           visibility_scope: getRequiredRoomThreadVisibility(\n             access.room.roomType\n           ),\n         },\n',
    "discussion visibility audit",
)
source = source.replace(
    'const post = await loadPost(service, roomId, postId);',
    'const post = await loadAccessiblePost(\n        service,\n        access,\n        roomId,\n        postId,\n        userId\n      );',
)
source = replace_once(
    source,
    '      const reply = replyResult.data as RoomRow;\n      if (asString(reply.author_id) !== userId && !access.canModerate) {\n',
    '      const reply = replyResult.data as RoomRow;\n      const parentPost = await loadAccessiblePost(\n        service,\n        access,\n        roomId,\n        asString(reply.post_id),\n        userId\n      );\n      if (!parentPost) return jsonError("Room reply not found.", 404);\n      if (asString(reply.author_id) !== userId && !access.canModerate) {\n',
    "reply parent authorization",
)
source = replace_once(
    source,
    '    return jsonError("Unsupported Room discussion action.", 400);\n',
    '    if (action === "add_participant" || action === "remove_participant") {\n      if (\n        !isCustomerSupportRoomType(access.room.roomType) ||\n        !access.canModerate\n      ) {\n        return jsonError(\n          "Only Customer Support Room staff can manage case participants.",\n          403\n        );\n      }\n      const postId = body?.postId;\n      const participantUserId = body?.participantUserId;\n      if (!validUuid(postId) || !validUuid(participantUserId)) {\n        return jsonError("Choose a valid support-case participant.", 400);\n      }\n      const post = await loadAccessiblePost(\n        service,\n        access,\n        roomId,\n        postId,\n        userId\n      );\n      if (!post) return jsonError("Support case not found.", 404);\n      if (asString(post.author_id) === participantUserId) {\n        return jsonError("The case author already has access.", 409);\n      }\n      const staffIds = await loadSupportStaffIds(service, access);\n      if (staffIds.includes(participantUserId)) {\n        return jsonError("Room support staff already have access.", 409);\n      }\n\n      if (action === "add_participant") {\n        const activeIds = await activeParticipantIds(\n          service,\n          access,\n          [participantUserId]\n        );\n        if (!activeIds.includes(participantUserId)) {\n          return jsonError("Only active Room members can be added.", 400);\n        }\n        const inserted = await service.from("room_post_participants").upsert(\n          {\n            room_id: roomId,\n            post_id: postId,\n            user_id: participantUserId,\n            added_by: userId,\n          },\n          { onConflict: "post_id,user_id" }\n        );\n        if (inserted.error) throw new Error(inserted.error.message);\n        await createNotifications([\n          {\n            user_id: participantUserId,\n            actor_id: userId,\n            type: "room_support_case_participant",\n            target_type: "room_post",\n            target_id: postId,\n            message: `You were added to a support case in ${access.room.name}.`,\n          },\n        ]);\n      } else {\n        const removed = await service\n          .from("room_post_participants")\n          .delete()\n          .eq("room_id", roomId)\n          .eq("post_id", postId)\n          .eq("user_id", participantUserId);\n        if (removed.error) throw new Error(removed.error.message);\n      }\n\n      await logAuditEvent({\n        actor_id: userId,\n        action:\n          action === "add_participant"\n            ? "room.support_case_participant_added"\n            : "room.support_case_participant_removed",\n        target_type: "room_post",\n        target_id: postId,\n        metadata: {\n          room_id: roomId,\n          participant_user_id: participantUserId,\n        },\n      });\n      return json({ ok: true });\n    }\n\n    return jsonError("Unsupported Room discussion action.", 400);\n',
    "participant actions",
)
write(path, source)


# Add privacy messaging and explicit participant controls to the Room UI.
path = "src/components/room-discussions-workspace.tsx"
source = Path(path).read_text()
source = replace_once(
    source,
    '  Eye,\n  Loader2,\n',
    '  Eye,\n  LockKeyhole,\n  Loader2,\n',
    "support privacy icon",
)
source = replace_once(
    source,
    '  Trash2,\n  type LucideIcon,\n',
    '  Trash2,\n  UserPlus,\n  X,\n  type LucideIcon,\n',
    "participant icons",
)
source = replace_once(
    source,
    'type RoomReply = {\n',
    'type RoomParticipant = {\n  userId: string;\n  profile: Profile | null;\n  addedBy: string;\n  addedByProfile: Profile | null;\n  createdAt: string | null;\n};\n\ntype ParticipantCandidate = {\n  userId: string;\n  role: string;\n  isStaff: boolean;\n  profile: Profile | null;\n};\n\ntype RoomReply = {\n',
    "participant UI types",
)
source = replace_once(
    source,
    '  discussionMetadata: DiscussionMetadata;\n  status: "open" | "resolved";\n',
    '  discussionMetadata: DiscussionMetadata;\n  visibilityScope: "room" | "author_and_staff";\n  status: "open" | "resolved";\n',
    "thread visibility type",
)
source = replace_once(
    source,
    '  canDelete: boolean;\n  replies: RoomReply[];\n',
    '  canDelete: boolean;\n  canManageParticipants: boolean;\n  participants: RoomParticipant[];\n  replies: RoomReply[];\n',
    "thread participants type",
)
source = replace_once(
    source,
    '  room?: { id: string; name: string };\n',
    '  room?: {\n    id: string;\n    name: string;\n    roomType: string;\n    requiredBehaviors: string[];\n    threadVisibilityScope: "room" | "author_and_staff";\n  };\n',
    "Room behavior response type",
)
source = replace_once(
    source,
    '    canModerate: boolean;\n    memberPostsAllowed: boolean;\n',
    '    canModerate: boolean;\n    canManageParticipants: boolean;\n    memberPostsAllowed: boolean;\n',
    "participant permission type",
)
source = replace_once(
    source,
    '  posts?: RoomThread[];\n',
    '  participantCandidates?: ParticipantCandidate[];\n  posts?: RoomThread[];\n',
    "participant candidates type",
)
source = replace_once(
    source,
    '  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});\n',
    '  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});\n  const [participantSelections, setParticipantSelections] = useState<\n    Record<string, string>\n  >({});\n',
    "participant selection state",
)
source = replace_once(
    source,
    '      .on(\n        "postgres_changes",\n        {\n          event: "*",\n          schema: "public",\n          table: "room_post_replies",\n          filter: `room_id=eq.${roomId}`,\n        },\n        reload\n      )\n      .subscribe();\n',
    '      .on(\n        "postgres_changes",\n        {\n          event: "*",\n          schema: "public",\n          table: "room_post_replies",\n          filter: `room_id=eq.${roomId}`,\n        },\n        reload\n      )\n      .on(\n        "postgres_changes",\n        {\n          event: "*",\n          schema: "public",\n          table: "room_post_participants",\n          filter: `room_id=eq.${roomId}`,\n        },\n        reload\n      )\n      .subscribe();\n',
    "participant realtime refresh",
)
source = replace_once(
    source,
    '  async function markRead(postId: string) {\n',
    '  async function addParticipant(postId: string) {\n    const participantUserId = participantSelections[postId] ?? "";\n    if (!participantUserId) return;\n    const completed = await performAction(\n      "add_participant",\n      { postId, participantUserId },\n      `add-participant:${postId}`,\n      "Support-case participant added."\n    );\n    if (completed) {\n      setParticipantSelections((current) => ({ ...current, [postId]: "" }));\n      setExpandedPostId(postId);\n    }\n  }\n\n  async function removeParticipant(postId: string, participantUserId: string) {\n    await performAction(\n      "remove_participant",\n      { postId, participantUserId },\n      `remove-participant:${postId}:${participantUserId}`,\n      "Support-case participant removed."\n    );\n  }\n\n  async function markRead(postId: string) {\n',
    "participant UI actions",
)
source = replace_once(
    source,
    '  const selectedMode = DISCUSSION_MODE_DEFINITIONS[mode];\n',
    '  const selectedMode = DISCUSSION_MODE_DEFINITIONS[mode];\n  const privateSupportThreads = Boolean(\n    data?.room?.requiredBehaviors?.includes("private_support_threads") ||\n      data?.room?.threadVisibilityScope === "author_and_staff"\n  );\n',
    "support behavior UI state",
)
source = replace_once(
    source,
    '      {data?.permissions?.canPost ? (\n',
    '      {privateSupportThreads ? (\n        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-100">\n          <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />\n          <div>\n            <strong className="font-black">Private Customer Support cases</strong>\n            <p className="mt-1 leading-6">\n              Each case is visible only to its author, active Room support staff,\n              and participants explicitly added by staff. This privacy rule cannot\n              be disabled.\n            </p>\n          </div>\n        </div>\n      ) : null}\n\n      {data?.permissions?.canPost ? (\n',
    "support privacy banner",
)
source = source.replace(
    '                 New Room discussion\n',
    '                 {privateSupportThreads ? "New private support case" : "New Room discussion"}\n',
    1,
)
source = source.replace(
    '                 Choose the structure the conversation needs\n',
    '                 {privateSupportThreads\n                   ? "Open a case for Room support staff"\n                   : "Choose the structure the conversation needs"}\n',
    1,
)
source = replace_once(
    source,
    '              Private to verified Room members\n',
    '              {privateSupportThreads\n                ? "Author, support staff, and added participants only"\n                : "Private to verified Room members"}\n',
    "composer privacy copy",
)
source = replace_once(
    source,
    '              Start discussion\n',
    '              {privateSupportThreads ? "Open support case" : "Start discussion"}\n',
    "composer support action",
)
source = replace_once(
    source,
    '                        {thread.status === "resolved" ? (\n',
    '                        {thread.visibilityScope === "author_and_staff" ? (\n                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">\n                            <LockKeyhole className="size-3" aria-hidden="true" />\n                            Private support case\n                          </span>\n                        ) : null}\n                        {thread.status === "resolved" ? (\n',
    "thread privacy badge",
)
source = replace_once(
    source,
    '                    <div className="mt-4 flex flex-wrap items-center gap-2">\n',
    '                    {privateSupportThreads ? (\n                      <section className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">\n                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">\n                          <div>\n                            <h4 className="flex items-center gap-2 text-sm font-black text-[var(--loombus-text)]">\n                              <LockKeyhole className="size-4" aria-hidden="true" />\n                              Case access\n                            </h4>\n                            <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">\n                              The author and active Room support staff always have access.\n                            </p>\n                          </div>\n                          <span className="text-xs font-bold text-[var(--loombus-text-subtle)]">\n                            {thread.participants.length} added participant{thread.participants.length === 1 ? "" : "s"}\n                          </span>\n                        </div>\n\n                        {thread.participants.length > 0 ? (\n                          <div className="mt-3 flex flex-wrap gap-2">\n                            {thread.participants.map((participant) => (\n                              <span\n                                key={participant.userId}\n                                className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-2 text-xs font-bold text-[var(--loombus-text)]"\n                              >\n                                {getProfileDisplayName(participant.profile)}\n                                {thread.canManageParticipants ? (\n                                  <button\n                                    type="button"\n                                    onClick={() =>\n                                      void removeParticipant(\n                                        thread.id,\n                                        participant.userId\n                                      )\n                                    }\n                                    disabled={\n                                      workingKey ===\n                                      `remove-participant:${thread.id}:${participant.userId}`\n                                    }\n                                    className="grid size-5 place-items-center rounded-full text-red-600 hover:bg-red-50 dark:text-red-300"\n                                    aria-label={`Remove ${getProfileDisplayName(participant.profile)} from this support case`}\n                                  >\n                                    <X className="size-3" aria-hidden="true" />\n                                  </button>\n                                ) : null}\n                              </span>\n                            ))}\n                          </div>\n                        ) : (\n                          <p className="mt-3 text-xs text-[var(--loombus-text-muted)]">\n                            No additional participants have been added.\n                          </p>\n                        )}\n\n                        {thread.canManageParticipants ? (\n                          <div className="mt-4 flex flex-col gap-2 sm:flex-row">\n                            <select\n                              value={participantSelections[thread.id] ?? ""}\n                              onChange={(event) =>\n                                setParticipantSelections((current) => ({\n                                  ...current,\n                                  [thread.id]: event.target.value,\n                                }))\n                              }\n                              className="min-h-11 min-w-0 flex-1 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm text-[var(--loombus-text)]"\n                            >\n                              <option value="">Add an active Room member</option>\n                              {(data?.participantCandidates ?? [])\n                                .filter(\n                                  (candidate) =>\n                                    !candidate.isStaff &&\n                                    candidate.userId !== thread.authorId &&\n                                    !thread.participants.some(\n                                      (participant) =>\n                                        participant.userId === candidate.userId\n                                    )\n                                )\n                                .map((candidate) => (\n                                  <option\n                                    key={candidate.userId}\n                                    value={candidate.userId}\n                                  >\n                                    {getProfileDisplayName(candidate.profile)}\n                                  </option>\n                                ))}\n                            </select>\n                            <button\n                              type="button"\n                              onClick={() => void addParticipant(thread.id)}\n                              disabled={\n                                !(participantSelections[thread.id] ?? "") ||\n                                workingKey === `add-participant:${thread.id}`\n                              }\n                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-xs font-black text-[var(--loombus-text)] disabled:opacity-50"\n                            >\n                              <UserPlus className="size-4" aria-hidden="true" />\n                              Add participant\n                            </button>\n                          </div>\n                        ) : null}\n                      </section>\n                    ) : null}\n\n                    <div className="mt-4 flex flex-wrap items-center gap-2">\n',
    "support participant manager",
)
source = replace_once(
    source,
    '               ? "Start a focused thread that stays inside this Room."\n',
    '               ? privateSupportThreads\n                 ? "Open a private case that only you and Room support staff can see."\n                 : "Start a focused thread that stays inside this Room."\n',
    "support empty-state copy",
)
write(path, source)
