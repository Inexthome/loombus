import "server-only";

import {
  ROOM_RESOURCE_BUCKET,
  SIGNED_RESOURCE_SECONDS,
  ensureRoomModule,
  serializeResource,
  ExpansionError,
} from "@/lib/room-expansion-service";
import { loadRoomCalendar } from "@/lib/room-calendar-service";
import { asString } from "@/lib/room-operations";

export async function loadCalendar(service, roomId, access, userId) {
  return loadRoomCalendar(service, roomId, access, userId, {
    advanced: true,
    rangeStart: new Date(Date.now() - 30 * 86400000).toISOString(),
    rangeEnd: new Date(Date.now() + 365 * 86400000).toISOString(),
    includeCancelled: true,
  });
}

export async function loadFiles(service, roomId, access, userId) {
  const plan = ensureRoomModule(access, "files");
  const result = await service
    .from("room_resources")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (result.error) throw new ExpansionError(result.error.message, 503);
  const rows = result.data ?? [];
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
  const usedBytes = resources.reduce(
    (total, resource) => total + resource.fileSizeBytes,
    0
  );
  return { resources, usedBytes, plan };
}
