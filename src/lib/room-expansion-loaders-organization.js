import "server-only";

import { asObject, cleanText, ensureOrganization, ensureRoomModule, loadProfilesMap, serializeRecord, validUuid, ExpansionError } from "@/lib/room-expansion-service";
import { asNumber, asString, profileFor } from "@/lib/room-operations";

async function countRoom(service, table, roomId, options = {}) {
  let query = service
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);
  if (options.activePosts) query = query.is("deleted_at", null);
  if (options.activeRecords) query = query.is("archived_at", null);
  if (options.currentFiles) query = query.eq("is_current", true);
  const result = await query;
  return result.error ? 0 : result.count ?? 0;
}

export async function loadOrganizationConsole(service, access, userId) {
  const { organization, organizationId, role } = await ensureOrganization(service, access, userId);
  const roomsResult = await service
    .from("rooms")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (roomsResult.error) throw new ExpansionError(roomsResult.error.message, 503);
  const rooms = roomsResult.data ?? [];
  const roomSummaries = await Promise.all(
    rooms.map(async (room) => {
      const roomId = asString(room.id);
      const [members, posts, records, files, events] = await Promise.all([
        countRoom(service, "room_members", roomId),
        countRoom(service, "room_posts", roomId, { activePosts: true }),
        countRoom(service, "room_module_records", roomId, { activeRecords: true }),
        countRoom(service, "room_resources", roomId, { currentFiles: true }),
        countRoom(service, "room_events", roomId),
      ]);
      const storageResult = await service
        .from("room_resources")
        .select("file_size_bytes")
        .eq("room_id", roomId);
      const storageBytes = storageResult.error
        ? 0
        : (storageResult.data ?? []).reduce(
            (total, resource) => total + Number(resource.file_size_bytes ?? 0),
            0
          );
      return {
        id: roomId,
        name: asString(room.name),
        description: asString(room.description),
        status: asString(room.status) || "active",
        plan: asString(room.subscription_plan) || "free",
        memberLimit:
          room.member_limit === null || room.member_limit === undefined
            ? null
            : asNumber(room.member_limit),
        members,
        posts,
        records,
        files,
        events,
        storageBytes,
      };
    })
  );
  return {
    organization: {
      id: organizationId,
      name: asString(organization.name),
      planKey: asString(organization.plan_key),
      branding: asObject(organization.branding),
      security: asObject(organization.security),
      role,
    },
    rooms: roomSummaries,
    totals: roomSummaries.reduce(
      (totals, room) => ({
        rooms: totals.rooms + 1,
        members: totals.members + room.members,
        posts: totals.posts + room.posts,
        records: totals.records + room.records,
        files: totals.files + room.files,
        events: totals.events + room.events,
        storageBytes: totals.storageBytes + room.storageBytes,
      }),
      { rooms: 0, members: 0, posts: 0, records: 0, files: 0, events: 0, storageBytes: 0 }
    ),
  };
}

export async function searchOrganization(service, access, userId, queryText) {
  const cleanQuery = cleanText(queryText, 160);
  if (cleanQuery.length < 2) throw new ExpansionError("Enter at least two characters.", 400);
  const { organizationId } = await ensureOrganization(service, access, userId);
  const roomsResult = await service
    .from("rooms")
    .select("id, name")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(25);
  if (roomsResult.error) throw new ExpansionError(roomsResult.error.message, 503);
  const results = [];
  for (const room of roomsResult.data ?? []) {
    const searched = await service.rpc("search_room_content", {
      target_room_id: room.id,
      search_text: cleanQuery,
      module_filter: null,
      result_limit: 15,
    });
    if (searched.error) continue;
    for (const item of searched.data ?? []) {
      results.push({
        roomId: asString(room.id),
        roomName: asString(room.name),
        moduleKey: asString(item.module_key),
        targetType: asString(item.target_type),
        targetId: asString(item.target_id),
        title: asString(item.title),
        snippet: asString(item.snippet),
        createdAt: asString(item.created_at) || null,
        rank: Number(item.rank ?? 0),
      });
    }
  }
  return results.sort((left, right) => right.rank - left.rank).slice(0, 75);
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportFormCsv(service, roomId, access, recordId) {
  ensureRoomModule(access, "forms");
  if (!access.canManage) throw new ExpansionError("Room management access is required.", 403);
  if (!validUuid(recordId)) throw new ExpansionError("Invalid form.", 400);
  const recordResult = await service
    .from("room_module_records")
    .select("*")
    .eq("id", recordId)
    .eq("room_id", roomId)
    .eq("module_key", "form")
    .is("archived_at", null)
    .maybeSingle();
  if (recordResult.error || !recordResult.data) throw new ExpansionError("Form not found.", 404);
  const record = serializeRecord(recordResult.data);
  const fields = Array.isArray(record.metadata.fields) ? record.metadata.fields : [];
  const responsesResult = await service
    .from("room_module_responses")
    .select("responder_id, payload, created_at")
    .eq("room_id", roomId)
    .eq("record_id", recordId)
    .eq("response_type", "form_submission")
    .order("created_at", { ascending: true });
  if (responsesResult.error) throw new ExpansionError(responsesResult.error.message, 503);
  const responses = responsesResult.data ?? [];
  const profiles = await loadProfilesMap(
    service,
    responses.map((response) => asString(response.responder_id))
  );
  const header = ["Submitted at", "Responder", ...fields.map((field) => asString(asObject(field).label))];
  const lines = [header.map(csvCell).join(",")];
  for (const response of responses) {
    const responderId = asString(response.responder_id);
    const profile = profileFor(profiles, responderId);
    const values = asObject(asObject(response.payload).values);
    lines.push(
      [
        asString(response.created_at),
        profile?.full_name || profile?.username || responderId,
        ...fields.map((field) => values[asString(asObject(field).id)] ?? ""),
      ].map(csvCell).join(",")
    );
  }
  return {
    fileName: `${record.title || "room-form"}-submissions.csv`
      .replace(/[^a-z0-9._-]+/gi, "-")
      .slice(0, 120),
    csv: lines.join("\n"),
  };
}
