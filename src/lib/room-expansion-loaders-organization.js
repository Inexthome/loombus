import "server-only";

import {
  asObject,
  cleanText,
  ensureOrganization,
  ensureRoomModule,
  loadProfilesMap,
  serializeRecord,
  validUuid,
  ExpansionError,
} from "@/lib/room-expansion-service";
import { loadStudioPage } from "@/lib/room-expansion-pagination";
import { asNumber, asString, profileFor } from "@/lib/room-operations";

const ORGANIZATION_ROOM_PAGE_SIZE = 12;
const ORGANIZATION_ROOM_TOTAL_LIMIT = 500;
const ORGANIZATION_STORAGE_ROW_LIMIT = 20000;
const ORGANIZATION_ROOM_STORAGE_ROW_LIMIT = 5000;
const ORGANIZATION_ROOM_ID_BATCH_SIZE = 100;
const ORGANIZATION_SEARCH_ROOM_LIMIT = 25;
const ORGANIZATION_SEARCH_CONCURRENCY = 5;
const ORGANIZATION_SEARCH_RESULT_LIMIT = 75;
const FORM_EXPORT_LIMIT = 5000;

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

async function countAcrossRooms(service, table, roomIds, options = {}) {
  if (!roomIds.length) return 0;
  const batches = [];
  for (let index = 0; index < roomIds.length; index += ORGANIZATION_ROOM_ID_BATCH_SIZE) {
    batches.push(roomIds.slice(index, index + ORGANIZATION_ROOM_ID_BATCH_SIZE));
  }
  const counts = await Promise.all(
    batches.map(async (batch) => {
      let query = service
        .from(table)
        .select("id", { count: "exact", head: true })
        .in("room_id", batch);
      if (options.activePosts) query = query.is("deleted_at", null);
      if (options.activeRecords) query = query.is("archived_at", null);
      if (options.currentFiles) query = query.eq("is_current", true);
      const result = await query;
      return result.error ? 0 : result.count ?? 0;
    })
  );
  return counts.reduce((total, value) => total + value, 0);
}

async function loadBoundedStorageRows(service, roomIds) {
  const rows = [];
  for (let index = 0; index < roomIds.length; index += ORGANIZATION_ROOM_ID_BATCH_SIZE) {
    const remaining = ORGANIZATION_STORAGE_ROW_LIMIT - rows.length;
    if (remaining <= 0) break;
    const batch = roomIds.slice(index, index + ORGANIZATION_ROOM_ID_BATCH_SIZE);
    const result = await service
      .from("room_resources")
      .select("file_size_bytes")
      .in("room_id", batch)
      .limit(remaining);
    if (!result.error) rows.push(...(result.data ?? []));
  }
  return rows;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  );
  return results;
}

async function organizationTotals(service, organizationId, totalRooms) {
  const roomIdsResult = await service
    .from("rooms")
    .select("id", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(ORGANIZATION_ROOM_TOTAL_LIMIT);
  if (roomIdsResult.error) {
    throw new ExpansionError(roomIdsResult.error.message, 503);
  }

  const roomIds = (roomIdsResult.data ?? []).map((row) => asString(row.id)).filter(Boolean);
  if (!roomIds.length) {
    return {
      totals: {
        rooms: totalRooms,
        members: 0,
        posts: 0,
        records: 0,
        files: 0,
        events: 0,
        storageBytes: 0,
      },
      limits: {
        totalsRoomLimit: ORGANIZATION_ROOM_TOTAL_LIMIT,
        totalsRoomsCapped: false,
        storageRowLimit: ORGANIZATION_STORAGE_ROW_LIMIT,
        storageRowsCapped: false,
      },
    };
  }

  const [members, posts, records, files, events, storageResult] = await Promise.all([
    countAcrossRooms(service, "room_members", roomIds),
    countAcrossRooms(service, "room_posts", roomIds, { activePosts: true }),
    countAcrossRooms(service, "room_module_records", roomIds, { activeRecords: true }),
    countAcrossRooms(service, "room_resources", roomIds, { currentFiles: true }),
    countAcrossRooms(service, "room_events", roomIds),
    loadBoundedStorageRows(service, roomIds),
  ]);

  const storageRows = Array.isArray(storageResult) ? storageResult : [];
  return {
    totals: {
      rooms: totalRooms,
      members,
      posts,
      records,
      files,
      events,
      storageBytes: storageRows.reduce(
        (total, resource) => total + Number(resource.file_size_bytes ?? 0),
        0
      ),
    },
    limits: {
      totalsRoomLimit: ORGANIZATION_ROOM_TOTAL_LIMIT,
      totalsRoomsCapped:
        (roomIdsResult.count ?? totalRooms) > ORGANIZATION_ROOM_TOTAL_LIMIT,
      storageRowLimit: ORGANIZATION_STORAGE_ROW_LIMIT,
      storageRowsCapped: storageRows.length >= ORGANIZATION_STORAGE_ROW_LIMIT,
    },
  };
}

export async function loadOrganizationConsole(
  service,
  access,
  userId,
  paging = {}
) {
  const { organization, organizationId, role } = await ensureOrganization(
    service,
    access,
    userId
  );
  const loaded = await loadStudioPage(
    ({ from, to }) =>
      service
        .from("rooms")
        .select(
          "id,name,description,status,subscription_plan,member_limit,created_at",
          { count: "exact" }
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true })
        .range(from, to),
    {
      page: paging.page,
      pageSize: Math.min(
        ORGANIZATION_ROOM_PAGE_SIZE,
        Number(paging.pageSize) || ORGANIZATION_ROOM_PAGE_SIZE
      ),
    }
  );
  if (loaded.result.error) {
    throw new ExpansionError(loaded.result.error.message, 503);
  }

  const rooms = loaded.result.data ?? [];
  const roomSummaries = await Promise.all(
    rooms.map(async (room) => {
      const roomId = asString(room.id);
      const [members, posts, records, files, events, storageResult] =
        await Promise.all([
          countRoom(service, "room_members", roomId),
          countRoom(service, "room_posts", roomId, { activePosts: true }),
          countRoom(service, "room_module_records", roomId, {
            activeRecords: true,
          }),
          countRoom(service, "room_resources", roomId, {
            currentFiles: true,
          }),
          countRoom(service, "room_events", roomId),
          service
            .from("room_resources")
            .select("file_size_bytes")
            .eq("room_id", roomId)
            .limit(ORGANIZATION_ROOM_STORAGE_ROW_LIMIT),
        ]);
      const storageRows = storageResult.error ? [] : storageResult.data ?? [];
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
        storageBytes: storageRows.reduce(
          (total, resource) => total + Number(resource.file_size_bytes ?? 0),
          0
        ),
        storageRowsCapped:
          storageRows.length >= ORGANIZATION_ROOM_STORAGE_ROW_LIMIT,
      };
    })
  );

  const aggregate = await organizationTotals(
    service,
    organizationId,
    loaded.pageInfo?.totalItems ?? roomSummaries.length
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
    pageInfo: loaded.pageInfo,
    totals: aggregate.totals,
    limits: {
      ...aggregate.limits,
      pageRoomLimit: ORGANIZATION_ROOM_PAGE_SIZE,
      pageStorageRowsCapped: roomSummaries.some((room) => room.storageRowsCapped),
    },
  };
}

export async function searchOrganization(service, access, userId, queryText) {
  const cleanQuery = cleanText(queryText, 160);
  if (cleanQuery.length < 2) {
    throw new ExpansionError("Enter at least two characters.", 400);
  }
  const { organizationId } = await ensureOrganization(service, access, userId);
  const roomsResult = await service
    .from("rooms")
    .select("id, name", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(ORGANIZATION_SEARCH_ROOM_LIMIT);
  if (roomsResult.error) {
    throw new ExpansionError(roomsResult.error.message, 503);
  }

  const groupedResults = await mapWithConcurrency(
    roomsResult.data ?? [],
    ORGANIZATION_SEARCH_CONCURRENCY,
    async (room) => {
      const searched = await service.rpc("search_room_content", {
        target_room_id: room.id,
        search_text: cleanQuery,
        module_filter: null,
        result_limit: 15,
      });
      if (searched.error) return [];
      return (searched.data ?? []).map((item) => ({
        roomId: asString(room.id),
        roomName: asString(room.name),
        moduleKey: asString(item.module_key),
        targetType: asString(item.target_type),
        targetId: asString(item.target_id),
        title: asString(item.title),
        snippet: asString(item.snippet),
        createdAt: asString(item.created_at) || null,
        rank: Number(item.rank ?? 0),
      }));
    }
  );
  const results = groupedResults.flat();

  return {
    items: results
      .sort((left, right) => right.rank - left.rank)
      .slice(0, ORGANIZATION_SEARCH_RESULT_LIMIT),
    limits: {
      roomsScanned: (roomsResult.data ?? []).length,
      roomLimit: ORGANIZATION_SEARCH_ROOM_LIMIT,
      roomsCapped:
        (roomsResult.count ?? 0) > ORGANIZATION_SEARCH_ROOM_LIMIT,
      resultLimit: ORGANIZATION_SEARCH_RESULT_LIMIT,
      resultsCapped: results.length > ORGANIZATION_SEARCH_RESULT_LIMIT,
    },
  };
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportFormCsv(service, roomId, access, recordId) {
  ensureRoomModule(access, "forms");
  if (!access.canManage) {
    throw new ExpansionError("Room management access is required.", 403);
  }
  if (!validUuid(recordId)) throw new ExpansionError("Invalid form.", 400);
  const recordResult = await service
    .from("room_module_records")
    .select("*")
    .eq("id", recordId)
    .eq("room_id", roomId)
    .eq("module_key", "form")
    .is("archived_at", null)
    .maybeSingle();
  if (recordResult.error || !recordResult.data) {
    throw new ExpansionError("Form not found.", 404);
  }
  const record = serializeRecord(recordResult.data);
  const fields = Array.isArray(record.metadata.fields)
    ? record.metadata.fields
    : [];
  const responsesResult = await service
    .from("room_module_responses")
    .select("responder_id, payload, created_at")
    .eq("room_id", roomId)
    .eq("record_id", recordId)
    .eq("response_type", "form_submission")
    .order("created_at", { ascending: true })
    .limit(FORM_EXPORT_LIMIT);
  if (responsesResult.error) {
    throw new ExpansionError(responsesResult.error.message, 503);
  }
  const responses = responsesResult.data ?? [];
  const profiles = await loadProfilesMap(
    service,
    responses.map((response) => asString(response.responder_id))
  );
  const header = [
    "Submitted at",
    "Responder",
    ...fields.map((field) => asString(asObject(field).label)),
  ];
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
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return {
    fileName: `${record.title || "room-form"}-submissions.csv`
      .replace(/[^a-z0-9._-]+/gi, "-")
      .slice(0, 120),
    csv: lines.join("\n"),
  };
}
