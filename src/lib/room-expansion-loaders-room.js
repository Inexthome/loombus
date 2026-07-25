import "server-only";

import {
  ROOM_RESOURCE_BUCKET,
  SIGNED_RESOURCE_SECONDS,
  ensureRoomModule,
  resourceUsage,
  serializeResource,
  ExpansionError,
} from "@/lib/room-expansion-service";
import { loadStudioPage } from "@/lib/room-expansion-pagination";
import { loadRoomCalendar } from "@/lib/room-calendar-runtime";
import { asString } from "@/lib/room-operations";

const MAX_FILE_VERSION_ROWS = 240;

export async function loadCalendar(service, roomId, access, userId) {
  return loadRoomCalendar(service, roomId, access, userId, {
    advanced: true,
    rangeStart: new Date(Date.now() - 30 * 86400000).toISOString(),
    rangeEnd: new Date(Date.now() + 365 * 86400000).toISOString(),
    includeCancelled: true,
  });
}

export async function loadFiles(
  service,
  roomId,
  access,
  userId,
  paging = {}
) {
  const plan = ensureRoomModule(access, "files");
  const loaded = await loadStudioPage(
    ({ from, to }) =>
      service
        .from("room_resources")
        .select("*", { count: "exact" })
        .eq("room_id", roomId)
        .or("is_current.eq.true,is_current.is.null")
        .order("created_at", { ascending: false })
        .range(from, to),
    paging
  );
  if (loaded.result.error) {
    throw new ExpansionError(loaded.result.error.message, 503);
  }

  const currentRows = loaded.result.data ?? [];
  const versionGroupIds = [
    ...new Set(
      currentRows
        .map((row) => asString(row.version_group_id) || asString(row.id))
        .filter(Boolean)
    ),
  ];
  const versionsResult = versionGroupIds.length
    ? await service
        .from("room_resources")
        .select("*")
        .eq("room_id", roomId)
        .in("version_group_id", versionGroupIds)
        .order("version_number", { ascending: false })
        .limit(MAX_FILE_VERSION_ROWS)
    : { data: [], error: null };
  if (versionsResult.error) {
    throw new ExpansionError(versionsResult.error.message, 503);
  }

  const rowsById = new Map();
  for (const row of [...currentRows, ...(versionsResult.data ?? [])]) {
    const id = asString(row.id);
    if (id) rowsById.set(id, row);
  }
  const rows = [...rowsById.values()];
  const resources = await Promise.all(
    rows.map(async (row) => {
      const signed = await service.storage
        .from(ROOM_RESOURCE_BUCKET)
        .createSignedUrl(asString(row.storage_path), SIGNED_RESOURCE_SECONDS);
      return serializeResource(
        row,
        signed.data?.signedUrl ?? null,
        access.canManage || asString(row.uploaded_by) === userId
      );
    })
  );
  const usedBytes = await resourceUsage(service, roomId);

  return {
    resources,
    usedBytes,
    plan,
    pageInfo: loaded.pageInfo,
    limits: {
      versions: MAX_FILE_VERSION_ROWS,
      relatedRowsTruncated:
        (versionsResult.data ?? []).length >= MAX_FILE_VERSION_ROWS,
    },
  };
}
