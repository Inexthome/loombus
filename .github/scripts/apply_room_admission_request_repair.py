from __future__ import annotations

from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1))


def append_once(path: str, marker: str, addition: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if marker in text:
        return
    file_path.write_text(text.rstrip() + "\n\n" + addition.strip() + "\n")


replace_once(
    "src/lib/room-plan-entitlements.ts",
    '''    | "resource"
    | "task"''',
    '''    | "resource"
    | "request"
    | "task"''',
)
replace_once(
    "src/lib/room-plan-entitlements.ts",
    '''  requests: {
    id: "requests",
    label: "Requests",
    description: "Structured Room requests and manager decisions, separate from membership admission.",
    minimumRole: "manager",
  },''',
    '''  requests: {
    id: "requests",
    label: "Requests",
    description:
      "Operational requests submitted by Room members, with assignment, priority, status, and manager decisions.",
    minimumRole: "member",
    dataModule: "request",
  },''',
)

route = "src/app/api/rooms/[roomId]/modules/route.ts"

replace_once(
    route,
    '''import { logAuditEvent } from "@/lib/audit-log";''',
    '''import { logAuditEvent } from "@/lib/audit-log";
import { createNotifications } from "@/lib/notifications";''',
)
replace_once(
    route,
    '''const DATA_MODULES = new Set([
  "resource",
  "task",''',
    '''const DATA_MODULES = new Set([
  "resource",
  "request",
  "task",''',
)
replace_once(
    route,
    '''async function loadAccess(service: ServiceClient, roomId: string, userId: string) {
  return getRoomAccess(service, roomId, userId).catch(() => null);
}

function roleCanOpenModule''',
    '''async function loadAccess(service: ServiceClient, roomId: string, userId: string) {
  return getRoomAccess(service, roomId, userId).catch(() => null);
}

function membershipRowIsActive(row: RoomRow) {
  const status = asString(row.status).toLowerCase();
  if (["blocked", "removed", "inactive"].includes(status)) return false;
  const suspendedUntil = safeIsoDate(row.suspended_until);
  return !suspendedUntil || new Date(suspendedUntil).getTime() <= Date.now();
}

async function activeRoomMemberIds(
  service: ServiceClient,
  access: RoomAccess,
  candidateIds: string[]
) {
  const candidates = [...new Set(candidateIds.filter(Boolean))];
  if (candidates.length === 0) return [];

  const result = await service
    .from("room_members")
    .select("user_id, status, suspended_until")
    .eq("room_id", access.room.id)
    .in("user_id", candidates);
  if (result.error) throw new Error(result.error.message);

  const active = new Set(
    ((result.data ?? []) as RoomRow[])
      .filter(membershipRowIsActive)
      .map((row) => asString(row.user_id))
      .filter(Boolean)
  );
  if (candidates.includes(access.room.ownerId)) active.add(access.room.ownerId);
  if (candidates.includes(access.room.createdBy)) active.add(access.room.createdBy);
  return [...active];
}

async function activeManagerIds(service: ServiceClient, access: RoomAccess) {
  const result = await service
    .from("room_members")
    .select("user_id, role, status, suspended_until")
    .eq("room_id", access.room.id)
    .in("role", ["owner", "admin", "administrator"])
    .not("status", "in", "(blocked,removed,inactive)")
    .limit(500);
  if (result.error) throw new Error(result.error.message);

  return [
    ...new Set(
      [
        access.room.ownerId,
        access.room.createdBy,
        ...((result.data ?? []) as RoomRow[])
          .filter(membershipRowIsActive)
          .map((row) => asString(row.user_id)),
      ].filter(Boolean)
    ),
  ];
}

async function notifyOperationalRequestCreated(
  service: ServiceClient,
  access: RoomAccess,
  record: ReturnType<typeof serializeRecord>,
  actorId: string
) {
  const managers = await activeManagerIds(service, access).catch(() => []);
  const recipients = managers.filter((userId) => userId !== actorId);
  if (recipients.length === 0) return;
  const { error } = await createNotifications(
    recipients.map((userId) => ({
      user_id: userId,
      actor_id: actorId,
      type: "room_operational_request",
      target_type: "room_module_record",
      target_id: record.id,
      message: `New request in ${access.room.name}: ${record.title}`,
    }))
  );
  if (error) console.error("Room request notifications failed:", error.message);
}

async function notifyOperationalRequestUpdated(
  service: ServiceClient,
  access: RoomAccess,
  record: ReturnType<typeof serializeRecord>,
  actorId: string
) {
  const metadata = asObject(record.metadata);
  const candidates = [record.createdBy, asString(metadata.assigneeId)].filter(
    (userId) => userId && userId !== actorId
  );
  const recipients = await activeRoomMemberIds(
    service,
    access,
    candidates
  ).catch(() => []);
  if (recipients.length === 0) return;
  const { error } = await createNotifications(
    recipients.map((userId) => ({
      user_id: userId,
      actor_id: actorId,
      type: "room_operational_request_update",
      target_type: "room_module_record",
      target_id: record.id,
      message: `Request updated in ${access.room.name}: ${record.title} (${record.status.replaceAll("_", " ")})`,
    }))
  );
  if (error) {
    console.error("Room request update notifications failed:", error.message);
  }
}

function roleCanOpenModule''',
)
replace_once(route, "async function loadRequests(", "async function loadJoinRequests(")
replace_once(
    route,
    '''  if (moduleKey === "tasks") {
    return {''',
    '''  if (moduleKey === "requests") {
    const priority = asString(source.priority);
    return {
      category: cleanText(source.category, 100) || "General",
      priority: ["low", "normal", "high", "urgent"].includes(priority)
        ? priority
        : "normal",
      dueAt: safeIsoDate(source.dueAt),
      assigneeId: validUuid(source.assigneeId) ? source.assigneeId : null,
    };
  }
  if (moduleKey === "tasks") {
    return {''',
)
replace_once(
    route,
    '''    } else if (requestedModule === "requests") {
      data = await loadRequests(serviceSupabase, roomId);
    } else if (''',
    '''    } else if (''',
)
replace_once(
    route,
    '''    } else if (requestedModule === "invites") {
      data = {
        invites: await loadInvites(serviceSupabase, roomId),
        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),
      };''',
    '''    } else if (requestedModule === "invites") {
      data = {
        invites: await loadInvites(serviceSupabase, roomId),
        joinRequests: await loadJoinRequests(serviceSupabase, roomId),
        settings: await getSettings(serviceSupabase, roomId, access.room.roomType),
      };''',
)
replace_once(
    route,
    '''async function operationalSummary(service: ServiceClient, roomId: string) {
  const [posts, events, announcements, members, requests, records, resources] =
    await Promise.all([''',
    '''async function operationalSummary(service: ServiceClient, roomId: string) {
  const [
    posts,
    events,
    announcements,
    members,
    joinRequests,
    requests,
    records,
    resources,
  ] = await Promise.all([''',
)
replace_once(
    route,
    '''      service
        .from("room_applications")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("state", "pending"),
      service
        .from("room_module_records")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .is("archived_at", null),''',
    '''      service
        .from("room_applications")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("state", "pending"),
      service
        .from("room_module_records")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("module_key", "request")
        .is("archived_at", null),
      service
        .from("room_module_records")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .is("archived_at", null),''',
)
replace_once(
    route,
    '''    members: members.error ? null : members.count ?? 0,
    requests: requests.error ? null : requests.count ?? 0,
    records: records.error ? null : records.count ?? 0,''',
    '''    members: members.error ? null : members.count ?? 0,
    joinRequests: joinRequests.error ? null : joinRequests.count ?? 0,
    requests: requests.error ? null : requests.count ?? 0,
    records: records.error ? null : records.count ?? 0,''',
)
replace_once(
    route,
    '''    if (action === "create_record") {
      if (!access.canManage) {
        return jsonError("Room management access is required.", 403);
      }
      const dataModule = dataModuleFor(moduleKey);
      if (!dataModule) return jsonError("This module does not accept records.", 400);
      const title = cleanText(body?.title, 200);
      if (!title) return jsonError("Enter a title.", 400);
      const inserted = await serviceSupabase
        .from("room_module_records")
        .insert({
          room_id: roomId,
          module_key: dataModule,
          title,
          body: cleanText(body?.body, 12000),
          status: ["tasks", "polls"].includes(moduleKey) ? "open" : "active",
          metadata: buildMetadata(moduleKey, body?.metadata),
          created_by: userId,
        })''',
    '''    if (action === "create_record") {
      if (!access.canManage && moduleKey !== "requests") {
        return jsonError("Room management access is required.", 403);
      }
      const dataModule = dataModuleFor(moduleKey);
      if (!dataModule || !DATA_MODULES.has(dataModule)) {
        return jsonError("This module does not accept records.", 400);
      }
      const title = cleanText(body?.title, 200);
      if (!title) return jsonError("Enter a title.", 400);
      const metadata = buildMetadata(moduleKey, body?.metadata);
      if (moduleKey === "requests" && !access.canManage) {
        metadata.assigneeId = null;
        metadata.dueAt = null;
      }
      const inserted = await serviceSupabase
        .from("room_module_records")
        .insert({
          room_id: roomId,
          module_key: dataModule,
          title,
          body: cleanText(body?.body, 12000),
          status: ["tasks", "polls", "requests"].includes(moduleKey)
            ? "open"
            : "active",
          metadata,
          created_by: userId,
        })''',
)
replace_once(
    route,
    '''      await logAuditEvent({
        actor_id: userId,
        action: `room.module.${dataModule}.created`,
        target_type: "room_module_record",
        target_id: record.id,
        metadata: { room_id: roomId, module: moduleKey },
      });
      return NextResponse.json(''',
    '''      await logAuditEvent({
        actor_id: userId,
        action: `room.module.${dataModule}.created`,
        target_type: "room_module_record",
        target_id: record.id,
        metadata: { room_id: roomId, module: moduleKey },
      });
      if (moduleKey === "requests") {
        await notifyOperationalRequestCreated(
          serviceSupabase,
          access,
          record,
          userId
        );
      }
      return NextResponse.json(''',
)
replace_once(
    route,
    '''      const assigned =
        moduleKey === "tasks" &&
        asString(asObject(row.metadata).assigneeId) === userId;
      if (!access.canManage && !assigned) {
        return jsonError("You cannot update this Room record.", 403);
      }
      const updates: JsonObject = {};
      const status = cleanText(body?.status, 40);
      if (status) updates.status = status;
      if (access.canManage) {
        const title = cleanText(body?.title, 200);
        if (title) updates.title = title;
        if (typeof body?.body === "string") {
          updates.body = cleanText(body.body, 12000);
        }
        if (body?.metadata !== undefined) {
          updates.metadata = buildMetadata(moduleKey, body.metadata);
        }
      }''',
    '''      const existingMetadata = asObject(row.metadata);
      const assignedTask =
        moduleKey === "tasks" &&
        asString(existingMetadata.assigneeId) === userId;
      const assignedRequest =
        moduleKey === "requests" &&
        asString(existingMetadata.assigneeId) === userId;
      const requestAuthor =
        moduleKey === "requests" && asString(row.created_by) === userId;
      if (
        !access.canManage &&
        !assignedTask &&
        !assignedRequest &&
        !requestAuthor
      ) {
        return jsonError("You cannot update this Room record.", 403);
      }

      const updates: JsonObject = {};
      const status = cleanText(body?.status, 40);
      if (moduleKey === "requests" && status) {
        const managerStatuses = [
          "open",
          "in_progress",
          "waiting",
          "completed",
          "declined",
          "cancelled",
        ];
        const assigneeStatuses = [
          "open",
          "in_progress",
          "waiting",
          "completed",
        ];
        const currentStatus = asString(row.status) || "open";
        const terminalStatuses = ["completed", "declined", "cancelled"];
        if (terminalStatuses.includes(currentStatus) && !access.canManage) {
          return jsonError("This request is already closed.", 409);
        }
        if (access.canManage && !managerStatuses.includes(status)) {
          return jsonError("Choose a valid request status.", 400);
        }
        if (!access.canManage && assignedRequest && !assigneeStatuses.includes(status)) {
          return jsonError("The assignee cannot apply that request status.", 403);
        }
        if (
          !access.canManage &&
          !assignedRequest &&
          requestAuthor &&
          status !== "cancelled"
        ) {
          return jsonError("Request authors may only cancel their request.", 403);
        }
        updates.status = status;
      } else if (status) {
        updates.status = status;
      }

      if (access.canManage) {
        const title = cleanText(body?.title, 200);
        if (title) updates.title = title;
        if (typeof body?.body === "string") {
          updates.body = cleanText(body.body, 12000);
        }
        if (body?.metadata !== undefined) {
          updates.metadata = buildMetadata(moduleKey, body.metadata);
        }
      }
      if (Object.keys(updates).length === 0) {
        return jsonError("No Room record changes were provided.", 400);
      }''',
)
replace_once(
    route,
    '''      if (updated.error) throw new Error(updated.error.message);
      await logAuditEvent({''',
    '''      if (updated.error) throw new Error(updated.error.message);
      const updatedRecord = serializeRecord(updated.data as RoomRow);
      await logAuditEvent({''',
)
replace_once(
    route,
    '''      return NextResponse.json(
        { ok: true, record: serializeRecord(updated.data as RoomRow) },
        { headers: { "Cache-Control": "private, no-store" } }
      );''',
    '''      if (moduleKey === "requests") {
        await notifyOperationalRequestUpdated(
          serviceSupabase,
          access,
          updatedRecord,
          userId
        );
      }
      return NextResponse.json(
        { ok: true, record: updatedRecord },
        { headers: { "Cache-Control": "private, no-store" } }
      );''',
)
replace_once(
    route,
    '''    if (action === "review_request") {
      if (!access.canManage) {''',
    '''    if (action === "review_request") {
      if (moduleKey !== "invites") {
        return jsonError(
          "Membership admission is managed through Invites / Join Requests.",
          400
        );
      }
      if (!access.canManage) {''',
)
replace_once(
    route,
    '''      if (requestResult.error || !requestResult.data) {
        return jsonError("Room request not found.", 404);
      }''',
    '''      if (requestResult.error || !requestResult.data) {
        return jsonError("Room join request not found.", 404);
      }''',
)
replace_once(
    route,
    '''      await logAuditEvent({
        actor_id: userId,
        action: "room.application_reviewed",
        target_type: "room_application",
        target_id: requestId,
        metadata: { room_id: roomId, applicant_id: applicantId, state },
      });
      return NextResponse.json(''',
    '''      await logAuditEvent({
        actor_id: userId,
        action: "room.application_reviewed",
        target_type: "room_application",
        target_id: requestId,
        metadata: { room_id: roomId, applicant_id: applicantId, state },
      });
      const { error: notificationError } = await createNotifications([
        {
          user_id: applicantId,
          actor_id: userId,
          type: "room_join_request_review",
          target_type: "room_application",
          target_id: requestId,
          message:
            state === "approved"
              ? `Your request to join ${access.room.name} was approved.`
              : `Your request to join ${access.room.name} was declined.`,
        },
      ]);
      if (notificationError) {
        console.error(
          "Room join-request review notification failed:",
          notificationError.message
        );
      }
      return NextResponse.json(''',
)

component = "src/components/room-tier-modules-workspace.tsx"

replace_once(component, "type RequestItem = {", "type JoinRequestItem = {")
replace_once(
    component,
    '''  if (moduleKey === "requests") {
    return (
      <RequestsPanel
        requests={Array.isArray(data) ? (data as RequestItem[]) : []}
        onReview={(requestId, state) =>
          action(
            "requests",
            { action: "review_request", requestId, state },
            state === "approved" ? "Room membership approved." : "Join request declined."
          )
        }
      />
    );
  }
  if (''',
    '''  if (''',
)
replace_once(
    component,
    '''        onRevoke={(inviteId) =>
          action("invites", { action: "revoke_invite", inviteId }, "Invitation revoked.")
        }
      />''',
    '''        onRevoke={(inviteId) =>
          action("invites", { action: "revoke_invite", inviteId }, "Invitation revoked.")
        }
        onReview={(requestId, state) =>
          action(
            "invites",
            { action: "review_request", requestId, state },
            state === "approved"
              ? "Room membership approved."
              : "Join request declined."
          )
        }
      />''',
)
replace_once(
    component,
    '''      {canManage ? (
        <CreateRecordForm
          moduleKey={moduleKey}
          members={members}
          onCreate={(payload) =>
            action(moduleKey, { action: "create_record", ...payload }, "Room item created.")
          }
        />
      ) : null}''',
    '''      {canManage || moduleKey === "requests" ? (
        <CreateRecordForm
          moduleKey={moduleKey}
          members={members}
          canManage={canManage}
          onCreate={(payload) =>
            action(
              moduleKey,
              { action: "create_record", ...payload },
              moduleKey === "requests"
                ? "Operational request submitted."
                : "Room item created."
            )
          }
        />
      ) : null}''',
)
replace_once(
    component,
    '''          <h3>No items have been added.</h3>
          <p>Room administrators can add the first item for this module.</p>''',
    '''          <h3>
            {moduleKey === "requests"
              ? "No operational requests"
              : "No items have been added."}
          </h3>
          <p>
            {moduleKey === "requests"
              ? "Room members can submit the first request."
              : "Room administrators can add the first item for this module."}
          </p>''',
)
replace_once(
    component,
    '''function CreateRecordForm({
  moduleKey,
  members,
  onCreate,
}: {
  moduleKey: RoomModuleKey;
  members: RoomMember[];
  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;
}) {''',
    '''function CreateRecordForm({
  moduleKey,
  members,
  canManage,
  onCreate,
}: {
  moduleKey: RoomModuleKey;
  members: RoomMember[];
  canManage: boolean;
  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;
}) {''',
)
replace_once(
    component,
    '''  const [fieldC, setFieldC] = useState("");
  const [toggle, setToggle] = useState(false);''',
    '''  const [fieldC, setFieldC] = useState("");
  const [fieldD, setFieldD] = useState("");
  const [toggle, setToggle] = useState(false);''',
)
replace_once(
    component,
    '''    setFieldC("");
    setToggle(false);''',
    '''    setFieldC("");
    setFieldD("");
    setToggle(false);''',
)
replace_once(
    component,
    '''    if (moduleKey === "resources") {
      metadata = { url: fieldA, category: fieldB };
    } else if (moduleKey === "tasks") {''',
    '''    if (moduleKey === "resources") {
      metadata = { url: fieldA, category: fieldB };
    } else if (moduleKey === "requests") {
      metadata = {
        category: fieldA,
        assigneeId: canManage ? fieldB || null : null,
        priority: fieldC || "normal",
        dueAt: canManage ? fieldD || null : null,
      };
    } else if (moduleKey === "tasks") {''',
)
replace_once(
    component,
    '''      setFieldC("");
      setToggle(false);''',
    '''      setFieldC("");
      setFieldD("");
      setToggle(false);''',
)
replace_once(
    component,
    '''  const titleLabel =
    moduleKey === "directory"
      ? "Contact name"''',
    '''  const titleLabel =
    moduleKey === "requests"
      ? "Request title"
      : moduleKey === "directory"
        ? "Contact name"''',
)
replace_once(
    component,
    '''          <h3>Add to this module</h3>
          <p>New entries remain inside the verified Room boundary.</p>''',
    '''          <h3>
            {moduleKey === "requests"
              ? "Submit an operational request"
              : "Add to this module"}
          </h3>
          <p>
            {moduleKey === "requests"
              ? "Track a Room need from submission through completion."
              : "New entries remain inside the verified Room boundary."}
          </p>''',
)
replace_once(
    component,
    '''        <span>{moduleKey === "knowledge" ? "Answer or content" : "Description or notes"}</span>''',
    '''        <span>
          {moduleKey === "requests"
            ? "Request details"
            : moduleKey === "knowledge"
              ? "Answer or content"
              : "Description or notes"}
        </span>''',
)
replace_once(
    component,
    '''      {moduleKey === "tasks" ? (
        <div className="room-tier-form-grid">''',
    '''      {moduleKey === "requests" ? (
        <div className="room-tier-form-grid">
          <label>
            <span>Category</span>
            <input
              value={fieldA}
              onChange={(event) => setFieldA(event.target.value)}
              placeholder="Maintenance, service, approval, support"
            />
          </label>
          <label>
            <span>Priority</span>
            <select value={fieldC} onChange={(event) => setFieldC(event.target.value)}>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          {canManage ? (
            <>
              <label>
                <span>Assignee</span>
                <select value={fieldB} onChange={(event) => setFieldB(event.target.value)}>
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {displayName(member.profile, member.userId)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Target date</span>
                <input
                  type="datetime-local"
                  value={fieldD}
                  onChange={(event) => setFieldD(event.target.value)}
                />
              </label>
            </>
          ) : null}
        </div>
      ) : null}

      {moduleKey === "tasks" ? (
        <div className="room-tier-form-grid">''',
)
replace_once(
    component,
    '''        {working ? "Saving…" : "Add item"}''',
    '''        {working
          ? "Saving…"
          : moduleKey === "requests"
            ? "Submit request"
            : "Add item"}''',
)
replace_once(
    component,
    '''  const workflowMemberId = asString(metadata.memberId);
  const workflowMember = members.find((member) => member.userId === workflowMemberId);

  if (moduleKey === "polls") {''',
    '''  const workflowMemberId = asString(metadata.memberId);
  const workflowMember = members.find((member) => member.userId === workflowMemberId);
  const requester = members.find((member) => member.userId === record.createdBy);
  const [requestAssigneeId, setRequestAssigneeId] = useState(assigneeId);

  useEffect(() => {
    setRequestAssigneeId(assigneeId);
  }, [assigneeId, record.id]);

  if (moduleKey === "polls") {''',
)
replace_once(
    component,
    '''      {moduleKey === "tasks" ? (
        <div className="room-tier-record-details">
          <span>Priority: {asString(metadata.priority) || "normal"}</span>
          <span>Assignee: {assignee ? displayName(assignee.profile, assignee.userId) : "Unassigned"}</span>
          {asString(metadata.dueAt) ? <span>Due: {formatDate(asString(metadata.dueAt))}</span> : null}
          {(canManage || assigneeId === currentUserId) && record.status !== "completed" ? (
            <button type="button" className="rooms-live-secondary-action" onClick={() => void onUpdate({ status: "completed" })}>
              <CheckCircle2 aria-hidden="true" /> Mark complete
            </button>
          ) : null}
        </div>
      ) : null}''',
    '''      {moduleKey === "tasks" ? (
        <div className="room-tier-record-details">
          <span>Priority: {asString(metadata.priority) || "normal"}</span>
          <span>Assignee: {assignee ? displayName(assignee.profile, assignee.userId) : "Unassigned"}</span>
          {asString(metadata.dueAt) ? <span>Due: {formatDate(asString(metadata.dueAt))}</span> : null}
          {(canManage || assigneeId === currentUserId) && record.status !== "completed" ? (
            <button type="button" className="rooms-live-secondary-action" onClick={() => void onUpdate({ status: "completed" })}>
              <CheckCircle2 aria-hidden="true" /> Mark complete
            </button>
          ) : null}
        </div>
      ) : null}

      {moduleKey === "requests" ? (
        <div className="room-tier-record-details">
          <span>Category: {asString(metadata.category) || "General"}</span>
          <span>Priority: {asString(metadata.priority) || "normal"}</span>
          <span>
            Requested by: {requester
              ? displayName(requester.profile, requester.userId)
              : record.createdBy}
          </span>
          <span>
            Assignee: {assignee
              ? displayName(assignee.profile, assignee.userId)
              : "Unassigned"}
          </span>
          {asString(metadata.dueAt) ? (
            <span>Target: {formatDate(asString(metadata.dueAt))}</span>
          ) : null}
          {canManage ? (
            <div className="room-tier-inline-actions">
              <select
                value={requestAssigneeId}
                onChange={(event) => setRequestAssigneeId(event.target.value)}
                aria-label={`Assign ${record.title}`}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {displayName(member.profile, member.userId)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rooms-live-secondary-action"
                onClick={() =>
                  void onUpdate({
                    metadata: {
                      ...metadata,
                      assigneeId: requestAssigneeId || null,
                    },
                  })
                }
              >
                <UserCheck aria-hidden="true" /> Save assignment
              </button>
            </div>
          ) : null}
          {(canManage || assigneeId === currentUserId) &&
          !["completed", "declined", "cancelled"].includes(record.status) ? (
            <div className="room-tier-inline-actions">
              {record.status !== "in_progress" ? (
                <button
                  type="button"
                  className="rooms-live-secondary-action"
                  onClick={() => void onUpdate({ status: "in_progress" })}
                >
                  <Clock3 aria-hidden="true" /> Start
                </button>
              ) : null}
              {record.status !== "waiting" ? (
                <button
                  type="button"
                  className="rooms-live-secondary-action"
                  onClick={() => void onUpdate({ status: "waiting" })}
                >
                  <Clock3 aria-hidden="true" /> Waiting
                </button>
              ) : null}
              <button
                type="button"
                className="rooms-live-primary-action"
                onClick={() => void onUpdate({ status: "completed" })}
              >
                <CheckCircle2 aria-hidden="true" /> Complete
              </button>
              {canManage ? (
                <button
                  type="button"
                  className="rooms-live-secondary-action"
                  onClick={() => void onUpdate({ status: "declined" })}
                >
                  <Trash2 aria-hidden="true" /> Decline
                </button>
              ) : null}
            </div>
          ) : null}
          {record.createdBy === currentUserId &&
          !["completed", "declined", "cancelled"].includes(record.status) ? (
            <button
              type="button"
              className="rooms-live-secondary-action"
              onClick={() => void onUpdate({ status: "cancelled" })}
            >
              <Trash2 aria-hidden="true" /> Cancel request
            </button>
          ) : null}
        </div>
      ) : null}''',
)
replace_once(
    component,
    '''function RequestsPanel({
  requests,
  onReview,
}: {
  requests: RequestItem[];''',
    '''function RequestsPanel({
  requests,
  onReview,
}: {
  requests: JoinRequestItem[];''',
)
replace_once(
    component,
    '''  if (pending.length === 0) {
    return <div className="room-tier-empty-state"><UserCheck aria-hidden="true" /><h3>No pending requests</h3><p>New Room join requests will appear here.</p></div>;
  }''',
    '''  if (pending.length === 0) {
    return <div className="room-tier-empty-state"><UserCheck aria-hidden="true" /><h3>No pending join requests</h3><p>Invitation redemptions that require approval will appear here.</p></div>;
  }''',
)
replace_once(
    component,
    '''function InvitesPanel({
  data,
  onCreate,
  onRevoke,
}: {
  data: unknown;
  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;
  onRevoke: (inviteId: string) => Promise<boolean>;
}) {''',
    '''function InvitesPanel({
  data,
  onCreate,
  onRevoke,
  onReview,
}: {
  data: unknown;
  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;
  onRevoke: (inviteId: string) => Promise<boolean>;
  onReview: (
    requestId: string,
    state: "approved" | "declined"
  ) => Promise<boolean>;
}) {''',
)
replace_once(
    component,
    '''    invites?: Array<{
      id: string;
      label: string;
      role: string;
      maxUses: number | null;
      useCount: number;
      expiresAt: string | null;
      revokedAt: string | null;
      createdAt: string | null;
    }>;
  };''',
    '''    invites?: Array<{
      id: string;
      label: string;
      role: string;
      maxUses: number | null;
      useCount: number;
      expiresAt: string | null;
      revokedAt: string | null;
      createdAt: string | null;
    }>;
    joinRequests?: JoinRequestItem[];
  };''',
)
replace_once(
    component,
    '''  const invites = source.invites ?? [];
  return (
    <div className="room-tier-records-layout">
      <form className="room-tier-create-card" onSubmit={submit}>''',
    '''  const invites = source.invites ?? [];
  const joinRequests = source.joinRequests ?? [];
  return (
    <div className="room-tier-records-layout">
      <section className="room-tier-create-card">
        <h3>Pending join requests</h3>
        <p>
          Review invitation redemptions that require administrator approval.
        </p>
        <RequestsPanel requests={joinRequests} onReview={onReview} />
      </section>
      <form className="room-tier-create-card" onSubmit={submit}>''',
)
replace_once(
    component,
    '''  const labels: Record<string, string> = { posts: "Discussions", events: "Events", announcements: "Announcements", members: "Members", requests: "Pending requests", records: "Module records", resources: "Stored files" };''',
    '''  const labels: Record<string, string> = {
    posts: "Discussions",
    events: "Events",
    announcements: "Announcements",
    members: "Members",
    joinRequests: "Pending join requests",
    requests: "Operational requests",
    records: "Module records",
    resources: "Stored files",
  };''',
)
append_once(
    "docs/rooms-entitlement-repair-order.md",
    "## Admission and operational requests contract",
    '''## Admission and operational requests contract

Membership admission and operational requests are separate product systems.

- `Invites / Join Requests` owns invitation creation, revocation, pending membership applications, approval, rejection, capacity checks, and admission notifications on every Room plan.
- The paid `Requests` module never reads or mutates `room_applications`.
- Starter-or-higher Room members may submit operational requests backed by `room_module_records` with the `request` module key.
- Operational requests record the requester, category, priority, assignment, target date, and workflow status.
- Room owners and administrators may assign, reprioritize, complete, decline, or cancel requests.
- Assigned members may move their requests through open, in-progress, waiting, and completed states.
- Request authors may cancel their own still-open requests.
- New operational requests notify active Room managers, and request updates notify active requesters and assignees.
''',
)
